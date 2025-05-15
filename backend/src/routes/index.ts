import { Application } from "express";
import { AuthRoutes } from "./auth"
import { UserRoutes } from "./user";
import { ContentRoutes } from "./content";
import { RecommendationRoutes } from "./recommendation";

export const router = (app: Application) => {
  app.use("/api/v1", AuthRoutes);
  app.use("/api/v1", UserRoutes);
  app.use("/api/v1", ContentRoutes);
  app.use("/api/v1", RecommendationRoutes);
}