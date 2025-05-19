import { Router } from "express";
import { deleteUser, getAllUsers, getUserById, getUserStats, updateUser } from "../controller/user/controller";
import { authenticateUser } from "../middleware/auth";

const router = Router();

router.get("/users", authenticateUser, getAllUsers);
router.get("/users/", authenticateUser, getUserById);
router.get("/users/:id/stats", authenticateUser, getUserStats)
router.put("/users/:id/update", authenticateUser, updateUser);
router.delete("/users/:id", authenticateUser, deleteUser);

export { router as UserRoutes }