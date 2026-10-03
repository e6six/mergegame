import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути к ассетам: площадка может отдавать игру не с корня
  // домена, а требование «никаких абсолютных путей» прописано в правилах.
  base: './',
  // Дев-сервер и превью доступны по внешнему хосту песочницы: без этого
  // Vite отклонит запрос по чужому Host и страница не откроется.
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    // Пакет для Yandex Games должен быть лёгким: лимит площадки — 100 МБ
    // распакованных, но целимся в считаные мегабайты для быстрой загрузки.
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
});
