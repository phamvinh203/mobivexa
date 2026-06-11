import { Express } from "express";

const mainRoutes = (app: Express): void => {
  const version = '/api';

  app.use(`${version}/auth`,       authRoutes);

}