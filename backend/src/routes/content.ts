import { Router } from "express";
import { ContentController } from "../controller/content/controller";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/contents", protect, ContentController.createContent);
router.get("/contents", protect, ContentController.getAllContent); // req.query.businessId
router.get("/contents/stats", protect, ContentController.getContentStats);
router.get("/contents/:id", protect, ContentController.getContentById);
 // req.query.id
router.put("/contents/:id/update", protect, ContentController.updateContent);
router.delete("/contents/:id/delete", protect, ContentController.deleteContent);


export { router as ContentRoutes }