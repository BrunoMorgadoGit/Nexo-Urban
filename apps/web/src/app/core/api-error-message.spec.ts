import { apiErrorMessage } from './api-error-message';

describe('apiErrorMessage', () => {
  it('keeps a useful server message and combines validation messages', () => {
    expect(apiErrorMessage({ error: { message: 'Identificação já cadastrada.' }, status: 409 })).toBe(
      'Identificação já cadastrada.',
    );
    expect(apiErrorMessage({ error: { message: ['CEP inválido.', 'Selecione o bairro.'] } })).toBe(
      'CEP inválido. Selecione o bairro.',
    );
  });

  it.each([
    [0, 'Não foi possível conectar aos serviços. Verifique sua conexão e tente novamente.'],
    [400, 'Não foi possível validar os dados enviados. Revise as informações e tente novamente.'],
    [401, 'A solicitação não foi autorizada. Atualize a tela e tente novamente.'],
    [403, 'Você não tem permissão para realizar esta ação.'],
    [404, 'O item solicitado não foi encontrado ou não está mais disponível.'],
    [409, 'Este registro conflita com informações já existentes. Revise os dados e tente novamente.'],
    [422, 'Os dados informados não podem ser processados. Revise os campos e tente novamente.'],
    [429, 'Muitas solicitações foram enviadas em pouco tempo. Aguarde e tente novamente.'],
    [500, 'O serviço encontrou um problema ao processar a solicitação. Tente novamente em instantes.'],
    [502, 'O serviço está temporariamente indisponível. Tente novamente em instantes.'],
    [503, 'O serviço está temporariamente indisponível. Tente novamente em instantes.'],
    [504, 'O serviço demorou para responder. Tente novamente em instantes.'],
  ])('provides a safe message for HTTP status %i', (status, message) => {
    expect(apiErrorMessage({ status })).toBe(message);
  });

  it('uses a generic message for malformed responses and unknown statuses', () => {
    const fallback = 'Não foi possível concluir a solicitação. Tente novamente.';
    expect(apiErrorMessage(new Error('private stack'))).toBe(fallback);
    expect(apiErrorMessage({ error: { message: 42 } })).toBe(fallback);
    expect(apiErrorMessage({ error: { message: ['válida', 42] } })).toBe(fallback);
    expect(apiErrorMessage({ status: 418 })).toBe(fallback);
  });
});
