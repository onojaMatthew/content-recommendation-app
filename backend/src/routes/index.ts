import { Application } from "express";
import { AuthRoutes } from "./auth"

export const router = (app: Application) => {
  app.use("/api/v1/auth", AuthRoutes);
}