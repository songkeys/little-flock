import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()],server:{port:4318,proxy:{'/api':{target:'http://localhost:8080',ws:true}}},build:{chunkSizeWarningLimit:1600,rollupOptions:{output:{manualChunks:{three:['three','@react-three/fiber','@react-three/drei','@react-three/postprocessing','postprocessing']}}}}})
