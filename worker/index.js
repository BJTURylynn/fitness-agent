export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return handleApi(request,env);
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const path=url.pathname==='/'?'/index.html':url.pathname;
    const body=ASSETS[path];
    if(body==null)return new Response('Not found',{status:404});
    const type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript';
    return new Response(request.method==='HEAD'?null:body,{headers:{
      'content-type':type+'; charset=utf-8','cache-control':'no-cache',
      'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
      'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
    }});
  }
};
