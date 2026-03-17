export type AppRoute = 'home' | 'scanning' | 'report' | 'login' | 'dashboard' | 'pricing' | 'community' | 'blog' | 'intel';

export function getRouteFromPath(path: string): AppRoute {
  if (path.startsWith('/auth/login')) return 'login';
  if (path.startsWith('/app/dashboard')) return 'dashboard';
  if (path.startsWith('/pricing')) return 'pricing';
  if (path.startsWith('/community')) return 'community';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/intel') || path.startsWith('/research')) return 'intel';
  return 'home';
}

export function consumeAuthTokenFromUrl(
  pathname: string,
  search: string,
  onToken: (token: string) => void,
): { route: AppRoute; consumedToken: boolean } {
  const params = new URLSearchParams(search);
  const token = params.get('token');
  if (token) {
    onToken(token);
    return {
      route: getRouteFromPath(pathname),
      consumedToken: true,
    };
  }

  return {
    route: getRouteFromPath(pathname),
    consumedToken: false,
  };
}
