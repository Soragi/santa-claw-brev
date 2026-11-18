import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/santa/',plugins:[react()],server:{proxy:{'/santa/api':{target:'http://127.0.0.1:4310',changeOrigin:false}}},build:{chunkSizeWarningLimit:800,emptyOutDir:true,rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/three/'))return 'three';if(id.includes('node_modules/@xterm/'))return 'xterm';if(id.includes('node_modules/react'))return 'react';}}}}});
