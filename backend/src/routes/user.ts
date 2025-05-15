import { Router } from "express";
import { UserController } from "../controller/user/controller";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/users", protect, UserController.getAllUsers);
router.get("/users/", protect, UserController.getUserById);
router.get("/users/:id/stats", protect, UserController.getUserStats)
router.put("/users/:id/update", protect, UserController.updateUser);
router.delete("/users/:id", protect, UserController.deleteUser);

export { router as UserRoutes }