// vite.config.ts
import { defineConfig } from "file:///C:/Users/bryde/Projects/StrafeChat/web.strafe.chat/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import solid from "file:///C:/Users/bryde/Projects/StrafeChat/web.strafe.chat/node_modules/vite-plugin-solid/dist/esm/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\bryde\\Projects\\StrafeChat\\web.strafe.chat";
var vite_config_default = defineConfig({
  plugins: [solid()],
  server: {
    port: 3e3,
    middlewareMode: false,
    fs: {
      strict: false
    },
    headers: {
      "Service-Worker-Allowed": "/"
    }
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__vite_injected_original_dirname, "index.html"),
        sw: resolve(__vite_injected_original_dirname, "public/service-worker.js")
      }
    }
  },
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxicnlkZVxcXFxQcm9qZWN0c1xcXFxTdHJhZmVDaGF0XFxcXHdlYi5zdHJhZmUuY2hhdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYnJ5ZGVcXFxcUHJvamVjdHNcXFxcU3RyYWZlQ2hhdFxcXFx3ZWIuc3RyYWZlLmNoYXRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2JyeWRlL1Byb2plY3RzL1N0cmFmZUNoYXQvd2ViLnN0cmFmZS5jaGF0L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHNvbGlkIGZyb20gXCJ2aXRlLXBsdWdpbi1zb2xpZFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbc29saWQoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgbWlkZGxld2FyZU1vZGU6IGZhbHNlLFxuICAgIGZzOiB7XG4gICAgICBzdHJpY3Q6IGZhbHNlLFxuICAgIH0sXG4gICAgaGVhZGVyczoge1xuICAgICAgXCJTZXJ2aWNlLVdvcmtlci1BbGxvd2VkXCI6IFwiL1wiLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiBcImVzbmV4dFwiLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIG1haW46IHJlc29sdmUoX19kaXJuYW1lLCBcImluZGV4Lmh0bWxcIiksXG4gICAgICAgIHN3OiByZXNvbHZlKF9fZGlybmFtZSwgXCJwdWJsaWMvc2VydmljZS13b3JrZXIuanNcIiksXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1YsU0FBUyxvQkFBb0I7QUFDalgsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sV0FBVztBQUZsQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sZ0JBQWdCO0FBQUEsSUFDaEIsSUFBSTtBQUFBLE1BQ0YsUUFBUTtBQUFBLElBQ1Y7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLDBCQUEwQjtBQUFBLElBQzVCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTSxRQUFRLGtDQUFXLFlBQVk7QUFBQSxRQUNyQyxJQUFJLFFBQVEsa0NBQVcsMEJBQTBCO0FBQUEsTUFDbkQ7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUNqQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
