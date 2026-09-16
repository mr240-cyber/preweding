import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        booking: resolve(__dirname, 'booking.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
        clientLogin: resolve(__dirname, 'client-login.html'),
        clientGallery: resolve(__dirname, 'client-gallery.html'),
        invoice: resolve(__dirname, 'invoice.html')
      }
    }
  }
});
