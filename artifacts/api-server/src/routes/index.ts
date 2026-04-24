import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import keysRouter from "./keys";
import settlementRouter from "./settlement";
import paymentsRouter from "./payments";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(keysRouter);
router.use(settlementRouter);
router.use(paymentsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);

export default router;
