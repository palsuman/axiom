import { AssociationService } from './association-service';
import { createMockEnv } from './test-utils/mock-env';

describe('AssociationService deep links', () => {
  const env = createMockEnv();
  const service = new AssociationService(env);

  it('parses workspace query parameter', () => {
    const request = service.parseDeepLink('nexus://open?workspace=/tmp/project', '/');
    expect(request).toEqual({ path: '/tmp/project', forceNew: false });
  });

  it('parses workspace from path segments', () => {
    const request = service.parseDeepLink('nexus://open/Users/test/project', '/');
    expect(request?.path).toBe('/Users/test/project');
  });

  it('honors window=new flag', () => {
    const request = service.parseDeepLink('nexus://workspace/%2Ftmp%2Fnexus?window=new', '/');
    expect(request?.forceNew).toBe(true);
  });

  it('returns null for unsupported schemes', () => {
    expect(service.parseDeepLink('https://example.com')).toBeNull();
    expect(service.parseDeepLink('nexus://unknown/action')).toBeNull();
  });
});
