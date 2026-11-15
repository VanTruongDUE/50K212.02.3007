const { NestFactory } = require('../03. Source code/backend/node_modules/@nestjs/core');
const cookieParser = require('../03. Source code/backend/node_modules/cookie-parser');
const { AppModule } = require('../03. Source code/backend/dist/app.module');

let application;

module.exports = async function handler(request, response) {
  if (!application) {
    application = (async () => {
      const app = await NestFactory.create(AppModule, { abortOnError: false });
      app.use(cookieParser());
      await app.init();
      return app.getHttpAdapter().getInstance();
    })().catch(error => {
      application = undefined;
      throw error;
    });
  }
  const server = await application;
  return server(request, response);
};
