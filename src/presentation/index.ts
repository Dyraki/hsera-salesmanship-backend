import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';

const PORT = process.env.PORT || 5003;

const app = createApp();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 HSERA Salesmanship Backend is running on port ${PORT}`);
  console.log(`🌐 Health check : http://localhost:${PORT}/health`);
  console.log(`📚 Swagger Docs : http://localhost:${PORT}/api-docs`);
  console.log(`📡 Base API URL : http://localhost:${PORT}/api/salesmanship`);
  console.log(`=======================================================`);
});
