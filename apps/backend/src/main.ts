import { createContainer } from "./container.js";

async function main(): Promise<void> {
  const container = await createContainer();
  const { config } = container;

  await container.server.listen({ port: config.PORT, host: config.HOST });
  container.server.log.info(
    `Backend escuchando en http://${config.HOST}:${config.PORT}`,
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    container.server.log.info(`Recibido ${signal}; cerrando...`);
    try {
      await container.server.close();
      await container.worker.close();
      await container.queue.close();
      await container.pool.end();
      await Promise.all(container.clients.map((client) => client.quit()));
      process.exit(0);
    } catch (error) {
      console.error("Error al cerrar:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Error fatal al iniciar:", error);
  process.exit(1);
});
