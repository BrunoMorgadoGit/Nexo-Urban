const fallbackMessages: Record<number, string> = {
  0: 'Não foi possível conectar aos serviços. Verifique sua conexão e tente novamente.',
  400: 'Não foi possível validar os dados enviados. Revise as informações e tente novamente.',
  401: 'A solicitação não foi autorizada. Atualize a tela e tente novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O item solicitado não foi encontrado ou não está mais disponível.',
  409: 'Este registro conflita com informações já existentes. Revise os dados e tente novamente.',
  422: 'Os dados informados não podem ser processados. Revise os campos e tente novamente.',
  429: 'Muitas solicitações foram enviadas em pouco tempo. Aguarde e tente novamente.',
  500: 'O serviço encontrou um problema ao processar a solicitação. Tente novamente em instantes.',
  502: 'O serviço está temporariamente indisponível. Tente novamente em instantes.',
  503: 'O serviço está temporariamente indisponível. Tente novamente em instantes.',
  504: 'O serviço demorou para responder. Tente novamente em instantes.',
};

function hasProperty(value: unknown, key: string): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

function responseMessage(body: unknown): string | undefined {
  if (!hasProperty(body, 'message')) return undefined;
  const message = body['message'];
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (Array.isArray(message) && message.every((item: unknown) => typeof item === 'string')) {
    const joined = message.map((item: string) => item.trim()).filter(Boolean).join(' ');
    return joined || undefined;
  }
  return undefined;
}

export function apiErrorMessage(error: unknown): string {
  const body = hasProperty(error, 'error') ? error['error'] : undefined;
  const message = responseMessage(body);
  if (message) return message;

  const status = hasProperty(error, 'status') && typeof error['status'] === 'number'
    ? error['status']
    : undefined;
  return (status === undefined ? undefined : fallbackMessages[status])
    ?? 'Não foi possível concluir a solicitação. Tente novamente.';
}
