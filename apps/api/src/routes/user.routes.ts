import { Router } from "express";

import { userIdParamSchema, userSchema } from "@rent/shared";
import { createUser, getUser, updateUser } from "../controllers/user.controller";
import { validateBody, validateParams } from "../middlewares/validate.middleware";

const userRouter = Router();

userRouter.post("/users", validateBody(userSchema), createUser);
userRouter.get("/users/:userId", validateParams(userIdParamSchema), getUser);
userRouter.put("/users/:userId", validateParams(userIdParamSchema), validateBody(userSchema), updateUser);

export { userRouter };