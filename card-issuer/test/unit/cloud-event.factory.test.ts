import { CloudEventFactory } from '../../src/shared/events/cloud-event.factory';

describe('CloudEventFactory', () => {
  it('arma el envelope de CloudEvents con id autoincremental por flujo (source)', () => {
    const first = CloudEventFactory.create('io.card.requested.v1', 'flujo-a', { foo: 'bar' });
    const second = CloudEventFactory.create('io.card.requested.v1', 'flujo-a', { foo: 'baz' });
    const otherFlow = CloudEventFactory.create('io.card.requested.v1', 'flujo-b', { foo: 'qux' });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(otherFlow.id).toBe(1);

    expect(first.source).toBe('flujo-a');
    expect(first.type).toBe('io.card.requested.v1');
    expect(first.data).toEqual({ foo: 'bar' });
    expect(typeof first.time).toBe('string');
  });
});
