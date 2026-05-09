const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function buildUpstreamUrl(requestUrl, apiOrigin) {
  const target = new URL(requestUrl);
  const origin = new URL(apiOrigin);
  const originPath = origin.pathname.replace(/\/$/, "");

  target.protocol = origin.protocol;
  target.hostname = origin.hostname;
  target.port = origin.port;
  target.username = origin.username;
  target.password = origin.password;

  if (originPath) {
    target.pathname = `${originPath}${target.pathname}`;
  }

  return target;
}

export async function onRequest({ request, env }) {
  const apiOrigin = env.API_ORIGIN || env.VITE_API_BASE_URL;

  if (!apiOrigin) {
    return Response.json(
      { msg: "API_ORIGIN is not configured for this Cloudflare Pages project." },
      { status: 500 },
    );
  }

  let upstreamUrl;
  try {
    upstreamUrl = buildUpstreamUrl(request.url, apiOrigin);
  } catch (_err) {
    return Response.json({ msg: "API_ORIGIN must be a valid http(s) URL." }, { status: 500 });
  }

  if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
    return Response.json({ msg: "API_ORIGIN must use http or https." }, { status: 500 });
  }

  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }
  headers.delete("host");
  headers.delete("origin");

  const incomingUrl = new URL(request.url);
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  const method = request.method.toUpperCase();
  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

