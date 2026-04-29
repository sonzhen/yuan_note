export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const workerUrl = `https://memo-widget-api.251237931.workers.dev${url.pathname}${url.search}`;
  
  const headers = new Headers(context.request.headers);
  
  const init: RequestInit = {
    method: context.request.method,
    headers,
  };
  
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }
  
  const response = await fetch(workerUrl, init);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
