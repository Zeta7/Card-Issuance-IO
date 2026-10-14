// Documento OpenAPI escrito a mano (sin generador) para mantenerlo en
// sincronía explícita con los esquemas Zod/entidades reales del servicio.
export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'card-issuer API',
    version: '1.0.0',
    description: 'Emisión de tarjetas para nuevos clientes vía arquitectura basada en eventos.'
  },
  servers: [{ url: '/' }],
  paths: {
    '/cards/issue': {
      post: {
        summary: 'Solicita la emisión de una tarjeta',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IssueCardRequest' },
              example: {
                customer: {
                  documentType: 'DNI',
                  documentNumber: '73425419',
                  fullName: 'Edson Meza',
                  age: 25,
                  email: 'edson@gmail.com'
                },
                product: { type: 'VISA', currency: 'PEN' },
                forceError: false
              }
            }
          }
        },
        responses: {
          '202': {
            description: 'Solicitud aceptada y publicada en Kafka',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/IssueCardResponse' } }
            }
          },
          '400': { description: 'Payload inválido' },
          '409': { description: 'El cliente ya tiene una solicitud de tarjeta activa' }
        }
      }
    },
    '/cards/all': {
      get: {
        summary: 'Lista todas las solicitudes de tarjeta registradas',
        responses: {
          '200': {
            description: 'Listado de solicitudes',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/CardRequest' } }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        summary: 'Estado de salud del servicio y de la conexión a Kafka',
        responses: {
          '200': { description: 'Servicio saludable' },
          '503': { description: 'Kafka no está conectado' }
        }
      }
    }
  },
  components: {
    schemas: {
      IssueCardRequest: {
        type: 'object',
        required: ['customer', 'product'],
        properties: {
          customer: {
            type: 'object',
            required: ['documentType', 'documentNumber', 'fullName', 'age', 'email'],
            properties: {
              documentType: { type: 'string', enum: ['DNI'] },
              documentNumber: { type: 'string', pattern: '^\\d{8}$', example: '73425419' },
              fullName: { type: 'string', minLength: 5 },
              age: { type: 'integer', minimum: 18 },
              email: { type: 'string', format: 'email' }
            }
          },
          product: {
            type: 'object',
            required: ['type', 'currency'],
            properties: {
              type: { type: 'string', enum: ['VISA'] },
              currency: { type: 'string', enum: ['PEN', 'USD'] }
            }
          },
          forceError: { type: 'boolean', nullable: true }
        }
      },
      IssueCardResponse: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['PENDING'] }
        }
      },
      CardRequest: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          customer: { $ref: '#/components/schemas/IssueCardRequest/properties/customer' },
          product: { $ref: '#/components/schemas/IssueCardRequest/properties/product' },
          status: { type: 'string', enum: ['PENDING', 'ISSUED', 'FAILED'] },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};
