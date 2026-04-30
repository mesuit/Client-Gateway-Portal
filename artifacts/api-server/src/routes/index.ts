import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import keysRouter from "./keys";
import settlementRouter from "./settlement";
import paymentsRouter from "./payments";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import paymentLinksRouter from "./payment-links";
import payRouter from "./pay";
import walletRouter from "./wallet";
import adminRouter from "./admin";
import activationRouter from "./activation";
import b2cRouter from "./b2c";
import b2cWalletRouter from "./b2c-wallet";
import pesapalRouter from "./pesapal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(keysRouter);
router.use(settlementRouter);
router.use(paymentsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(paymentLinksRouter);
router.use(payRouter);
router.use(walletRouter);
router.use(adminRouter);
router.use(activationRouter);
router.use(b2cRouter);
router.use(b2cWalletRouter);
router.use(pesapalRouter);

export default router;
