import { Router } from "express";
import { UserController } from "../controller/user/controller";
import { authenticateUser } from "../middleware/auth";

const router = Router();

router.get("/users", authenticateUser, UserController.getAllUsers);
router.get("/users/", authenticateUser, UserController.getUserById);
router.get("/users/:id/stats", authenticateUser, UserController.getUserStats)
router.put("/users/:id/update", authenticateUser, UserController.updateUser);
router.delete("/users/:id", authenticateUser, UserController.deleteUser);

export { router as UserRoutes }