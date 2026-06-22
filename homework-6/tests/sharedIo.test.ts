import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureDirs, writeMessage, moveMessage, readResults, clearShared, sharedPaths } from '../lib/sharedIo';
import { AgentMessage } from '../lib/types';

function makeMsg(id: string): AgentMessage {
  return {
    message_id: 'm-' + id,
    timestamp: '2026-03-16T09:00:00Z',
    source_agent: 'integrator',
    target_agent: 'transaction_validator',
    message_type: 'transaction',
    data: { transaction_id: id, amount: '1500.00', currency: 'USD', status: 'new' },
  };
}

describe('sharedIo', () => {
  it('creates the four dirs, writes/moves/reads messages, and clears', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-'));
    const p = sharedPaths(base);
    ensureDirs(base);
    expect(fs.existsSync(p.input)).toBe(true);
    expect(fs.existsSync(p.results)).toBe(true);

    writeMessage(p.input, makeMsg('TXN001'));
    moveMessage(p.input, p.results, 'TXN001');
    const results = readResults(base);
    expect(results).toHaveLength(1);
    expect(results[0].data.transaction_id).toBe('TXN001');

    clearShared(base);
    expect(readResults(base)).toHaveLength(0);
  });
});
