import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type DatabaseError = Error & {
  code?: string;
  driverError?: { code?: string };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const databaseError = exception as DatabaseError | undefined;
    const databaseCode = databaseError?.code ?? databaseError?.driverError?.code;

    if (databaseCode === '23505') {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Já existe um registro com o mesmo identificador.',
        path: request.url,
      });
      return;
    }
    if (databaseCode === '23503' || databaseCode === '23514') {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Os dados enviados não atendem às regras de integridade do inventário.',
        path: request.url,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json({
        ...(typeof body === 'string' ? { message: body } : body),
        path: request.url,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ocorreu um erro ao processar a solicitação.',
      path: request.url,
    });
  }
}
