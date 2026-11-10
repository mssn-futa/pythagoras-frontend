import { Route } from "react-router-dom";

/**
 * Converts route-slot objects ({ path, index, element, children }) into
 * <Route> elements so App can mount domain slots inside its guarded layouts.
 * The `public` flag is consumed by App and not forwarded.
 */
export function renderRoutes(routes, keyPrefix = "slot") {
  return routes.map((route, position) => {
    const key = `${keyPrefix}-${route.index ? "index" : route.path ?? "layout"}-${position}`;
    if (route.index) return <Route key={key} index element={route.element} />;
    return (
      <Route key={key} path={route.path} element={route.element}>
        {route.children ? renderRoutes(route.children, key) : null}
      </Route>
    );
  });
}

export function splitPublicRoutes(routes) {
  return {
    publicRoutes: routes.filter((route) => route.public === true),
    protectedRoutes: routes.filter((route) => route.public !== true),
  };
}
