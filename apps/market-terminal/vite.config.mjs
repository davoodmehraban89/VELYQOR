import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  server:{
    port:5178,
    fs:{allow:['../..']},
    proxy:{'/api':{target:'https://app.chartnova.ir',changeOrigin:true,secure:true}},
  },
});
