import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({from:vi.fn(),getUser:vi.fn(),updateUser:vi.fn(),presign:vi.fn()}));
vi.mock('../../api/_lib/supabase.js',()=>({supabase:{from:m.from,auth:{getUser:m.getUser,admin:{updateUserById:m.updateUser}}}}));
vi.mock('../../api/_lib/cors.js',()=>({handleCors:()=>false,getCorsHeaders:()=>({'Access-Control-Allow-Origin':'https://muvidb.com'})}));
vi.mock('../../api/_lib/r2.js',()=>({uploadToR2:vi.fn(),createR2UploadUrl:m.presign}));
import {handlePersonMedia} from '../../api/_lib/person_media_handler';
import {handleWhatsApp} from '../../api/_lib/whatsapp_handler';
import {handleOpay} from '../../api/_lib/opay_handler';
import {handleBachs} from '../../api/_lib/bachs_handler';
import {handleChannels} from '../../api/_lib/channels_handler';
import mediaHandler from '../../api/media';
import {isValidAuth} from '../../api/_lib/auth';
let q:any;
function res(){const r:any={status:vi.fn(()=>r),json:vi.fn(()=>r),setHeader:vi.fn(),send:vi.fn(),end:vi.fn()};return r;}
beforeEach(()=>{vi.clearAllMocks();q={then:(resolve:any)=>Promise.resolve({data:null,error:null}).then(resolve)};for(const name of ['delete','eq','select','single','maybeSingle','upsert','update','insert','limit','in','ilike'])q[name]=vi.fn(()=>q);m.from.mockReturnValue(q);m.getUser.mockResolvedValue({data:{user:{id:'test-user',email:'audit@example.invalid',user_metadata:{role:'admin'}}},error:null});m.updateUser.mockResolvedValue({error:null});});
it('unauthenticated person-media deletion reaches service-role mutation',async()=>{const r=res();await handlePersonMedia({method:'DELETE',headers:{},query:{id:'media-test'}} as any,r);expect(q.delete).toHaveBeenCalled();expect(r.status).toHaveBeenCalledWith(200);});
it('unauthenticated person-media request receives an upload capability',async()=>{m.presign.mockResolvedValue({uploadUrl:'https://example.invalid/upload',publicUrl:'https://example.invalid/file',key:'test'});const r=res();await handlePersonMedia({method:'POST',headers:{},query:{action:'presign'},body:{fileName:'audit.html',mimeType:'text/html',personId:'any-person'}} as any,r);expect(m.presign).toHaveBeenCalled();expect(r.status).toHaveBeenCalledWith(200);});
it('WhatsApp profile sync persists a user-controlled admin role',async()=>{const r=res();await handleWhatsApp({method:'POST',headers:{authorization:'Bearer test-token'},query:{action:'sync-user'},body:{}} as any,r);expect(q.upsert).toHaveBeenCalledWith(expect.objectContaining({role:'admin'}),{onConflict:'id'});expect(r.status).toHaveBeenCalledWith(200);});
it('admin auth falls back to user-controlled metadata when profile is missing',async()=>{expect((await isValidAuth({headers:{authorization:'Bearer test-token'}} as any)).valid).toBe(true);});
it.each([['OPay',handleOpay],['Bachs',handleBachs]])('%s sandbox endpoint upgrades a company without authentication or payment',async(_name,handler)=>{const r=res();await handler({method:'POST',url:'/api/payment',headers:{},query:{op:'confirm_sandbox'},body:{companyId:'company-test'}} as any,r);expect(q.update).toHaveBeenCalledWith({api_tier:'pro'});expect(r.status).toHaveBeenCalledWith(200);});
it('OPay webhook upgrades company without signature even when secret is configured',async()=>{vi.stubEnv('OPAY_SECRET_KEY','configured-test-secret');const r=res();await handleOpay({method:'POST',url:'/api/opay',headers:{},query:{op:'webhook'},body:{status:'SUCCESS',reference:'MUV_CMP_company-test_123'}} as any,r);expect(q.update).toHaveBeenCalledWith({api_tier:'pro'});vi.unstubAllEnvs();});
it('channel link endpoint reaches catalogue writes without authentication',async()=>{const r=res();await handleChannels({method:'POST',headers:{},query:{action:'link_video'},body:{film_id:'film-test',channel_id:'channel-test',video_id:'12345678901',title:'Audit'}} as any,r);expect(q.insert).toHaveBeenCalled();expect(r.status).toHaveBeenCalledWith(200);});
it('unsigned WhatsApp STOP payload reaches preference mutation',async()=>{const r=res();await handleWhatsApp({method:'POST',headers:{},query:{action:'webhook'},body:{entry:[{changes:[{value:{messages:[{from:'2348000000000',text:{body:'STOP'}}]}}]}]}} as any,r);expect(q.update).toHaveBeenCalledWith({whatsapp_enabled:false});expect(r.status).toHaveBeenCalledWith(200);});

it('public media proxy serves attacker SVG inline from the application origin',async()=>{
const svg='<svg xmlns="http://www.w3.org/2000/svg"><script>/* inert audit fixture */</script></svg>';
vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(svg,{headers:{'content-type':'image/svg+xml'}})));
const r=res();await mediaHandler({method:'GET',headers:{},query:{url:'https://example.invalid/image.svg'}} as any,r);
expect(r.setHeader).toHaveBeenCalledWith('Content-Type','image/svg+xml');
expect(r.setHeader).toHaveBeenCalledWith('Content-Disposition','inline');
expect(r.send).toHaveBeenCalledWith(Buffer.from(svg));vi.unstubAllGlobals();
});

it('unsigned Bachs payment success is accepted when signature header is absent',async()=>{vi.stubEnv('BACHS_WEBHOOK_SECRET','configured-test-secret');const r=res();await handleBachs({method:'POST',url:'/api/bachs',headers:{},query:{op:'webhook'},body:{type:'checkout.completed',data:{metadata:{company_id:'company-test'}}}} as any,r);expect(q.update).toHaveBeenCalledWith({api_tier:'pro'});vi.unstubAllEnvs();});

it('media proxy permits an IPv4-mapped IPv6 loopback URL without outbound network',async()=>{const f=vi.fn().mockResolvedValue(new Response(new Uint8Array([255,216,255])));vi.stubGlobal('fetch',f);const r=res();await mediaHandler({method:'GET',headers:{},query:{url:'http://[::ffff:127.0.0.1]/internal'}} as any,r);expect(f).toHaveBeenCalled();expect(r.send).toHaveBeenCalled();vi.unstubAllGlobals();});
