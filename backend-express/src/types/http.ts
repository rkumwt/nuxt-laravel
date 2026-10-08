import type { Request } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

// A request whose body has already been parsed by validate(schema)
export type BodyRequest<TBody, TParams extends ParamsDictionary = ParamsDictionary> = Request<
  TParams,
  unknown,
  TBody
>;
