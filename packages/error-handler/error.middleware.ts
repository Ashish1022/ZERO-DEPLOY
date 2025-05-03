import { NextFunction, Request, Response } from "express";
import { AppError } from ".";

export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        console.log(`Error ${req.method} ${req.url} - ${err.message}`);
        return res.status(err.status_code).json({
            status: "error",
            message: err.message,
            ...(err.details && { details: err.details }),
        });
    };
    console.error(`Unhandled Error: ${err.message}`);
    return res.status(500).json({
        status: "error",
        message: "Something went wrong. Please try again later.",
    });
};