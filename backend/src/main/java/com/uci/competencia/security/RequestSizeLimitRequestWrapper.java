package com.uci.competencia.security;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * Wrapper para HttpServletRequest que limita la cantidad de bytes que se pueden leer.
 * Previene ataques DoS donde se envían payloads enormes.
 */
public class RequestSizeLimitRequestWrapper extends HttpServletRequestWrapper {

    private final long maxSize;
    private ServletInputStream limitedInputStream;
    private BufferedReader reader;

    public RequestSizeLimitRequestWrapper(HttpServletRequest request, long maxSize) {
        super(request);
        this.maxSize = maxSize;
    }

    @Override
    public ServletInputStream getInputStream() throws IOException {
        if (limitedInputStream == null) {
            limitedInputStream = new LimitedServletInputStream(super.getInputStream(), maxSize);
        }
        return limitedInputStream;
    }

    @Override
    public BufferedReader getReader() throws IOException {
        if (reader == null) {
            Charset charset = StandardCharsets.UTF_8;
            String encoding = getCharacterEncoding();
            if (encoding != null && !encoding.isBlank()) {
                try {
                    charset = Charset.forName(encoding);
                } catch (Exception ignored) {
                    charset = StandardCharsets.UTF_8;
                }
            }
            reader = new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
        return reader;
    }

    private static class LimitedServletInputStream extends ServletInputStream {

        private final ServletInputStream delegate;
        private final long maxSize;
        private long bytesRead = 0;
        private boolean finished = false;

        public LimitedServletInputStream(ServletInputStream delegate, long maxSize) {
            this.delegate = delegate;
            this.maxSize = maxSize;
        }

        @Override
        public int read() throws IOException {
            if (bytesRead >= maxSize) {
                finished = true;
                throw new IOException("Request payload exceeds maximum allowed size.");
            }
            int b = delegate.read();
            if (b != -1) {
                bytesRead++;
            } else {
                finished = true;
            }
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (bytesRead >= maxSize) {
                finished = true;
                throw new IOException("Request payload exceeds maximum allowed size.");
            }
            long remaining = maxSize - bytesRead;
            int bytesToRead = (int) Math.min(len, remaining);
            int bytes = delegate.read(b, off, bytesToRead);
            if (bytes > 0) {
                bytesRead += bytes;
            } else {
                finished = true;
            }
            return bytes;
        }

        @Override
        public boolean isFinished() {
            return finished || delegate.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            delegate.setReadListener(readListener);
        }
    }
}