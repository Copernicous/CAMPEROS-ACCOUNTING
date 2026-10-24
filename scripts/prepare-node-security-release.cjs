// Project-owned local compilation and disposable database validation. Never deploys.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const PROJECT="CAMPEROS-ACCOUNTING";
const root=path.resolve(__dirname,'..');
const argv=process.argv.slice(2);const argument=k=>argv[argv.indexOf(k)+1];
if(!argv.includes('--env-file')||!argv.includes('--output'))throw Error('Supply an explicit loopback maintenance --env-file and a new --output directory.');
process.chdir(root);const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
if(git('status','--porcelain')||fs.existsSync(path.join(root,'.env')))throw Error('A clean committed checkout without .env is required.');
const output=path.resolve(argument('--output'));fs.mkdirSync(output,{recursive:false});
const pkg=require('../package.json'),commit=git('rev-parse','HEAD');
const cfg=require('dotenv').parse(fs.readFileSync(path.resolve(argument('--env-file'))));
if(cfg.DB_HOST!=='127.0.0.1'||!cfg.DB_USER||!cfg.DB_PASS)throw Error('Explicit loopback maintenance credentials required.');
const {Client}=require('pg');const database='security_'+PROJECT.toLowerCase().replace(/[^a-z0-9]/g,'_')+'_test_'+crypto.randomBytes(5).toString('hex');
const env={...process.env,NODE_ENV:'development',DB_HOST:'127.0.0.1',DB_PORT:cfg.DB_PORT||'5432',DB_USER:cfg.DB_USER,DB_PASS:cfg.DB_PASS,DB_NAME:database,LOCAL_RELEASE_TEST_PORT:cfg.DB_PORT||'5432',QA_DB_NAME:database,QA_ALLOW_NON_QA_DB:'false',ALLOW_DEFAULT_SEED:'true',JWT_SECRET:crypto.randomBytes(32).toString('hex'),SETTINGS_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),SOFTPHONE_CREDENTIAL_KEY:crypto.randomBytes(32).toString('hex'),BACKUP_SCHEDULER_ENABLED:'false',SITE_BACKUP_SCHEDULER_ENABLED:'false',SYSLOG_ENABLED:'false',SYSLOG_AUTO_DISCOVER:'false',LOG_FILE:'false',SMTP_HOST:'',SMTP_USER:'',SMTP_PASS:'',SMTP_ENABLED:'false',EMAIL_ENABLED:'false',APP_WRITABLE_ROOT:path.join(output,'runtime')};
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const checks=[];
function run(label,program,args,extra={}) {
 const fd=fs.openSync(path.join(output,label+'.log'),'w');let r;
 try{r=spawnSync(program,args,{cwd:root,env:{...env,...extra},stdio:['ignore',fd,fd],timeout:600000,windowsHide:true});}finally{fs.closeSync(fd);}
 if(r.error||r.status!==0)throw Error(label+' failed; inspect its local log. No release may be published.');
 checks.push(label);console.log('PASS '+label);
}
async function freePort(){const s=net.createServer();await new Promise((res,rej)=>s.once('error',rej).listen(0,'127.0.0.1',res));const p=s.address().port;await new Promise(res=>s.close(res));return p;}
async function stop(child){if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}}
async function smoke(label,program,args) {
 const port=await freePort();const fd=fs.openSync(path.join(output,label+'-server.log'),'w');const base='http://127.0.0.1:'+port;
 const child=spawn(program,args,{cwd:root,env:{...env,PORT:String(port),APP_ORIGIN:base,APP_ORIGINS:base},stdio:['ignore',fd,fd],windowsHide:true});
 try {
  let ready=false;
  for(let i=0;i<90;i++){
   if(child.exitCode!==null)throw Error(label+' exited before readiness.');
   try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready)throw Error(label+' readiness timed out.');
  let token;
  for(const password of ['admin123','admin']){
   const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password})});
   if(r.ok){token=(await r.json()).token;if(token)break;}
  }
  if(!token)throw Error(label+' could not authenticate its synthetic first-run account.');
  const headers={authorization:'Bearer '+token,cookie:'token='+token+'; haToken='+token};
  const version=await fetch(base+'/api/version',{headers});if(!version.ok)throw Error('Version endpoint failed.');
  const info=await version.json();if(info.version!==pkg.version)throw Error('Running version differs from candidate.');
  const dashboard=await fetch(base+'/dashboard',{headers});if(!dashboard.ok)throw Error('Authenticated dashboard failed.');
  // Malformed compressed data must not terminate the process after parsing.
  const {gzipSync}=require('node:zlib');const body=Buffer.concat([gzipSync(Buffer.from('{}')),Buffer.from('invalid trailing bytes')]);
  try{await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json','content-encoding':'gzip'},body,signal:AbortSignal.timeout(5000)});}catch{}
  if(child.exitCode!==null||(await fetch(base+'/login')).status!==200)throw Error('Compressed input terminated application.');
  checks.push(label);console.log('PASS '+label);
 }finally{await stop(child);fs.closeSync(fd);}
}
const admin=new Client({host:'127.0.0.1',port:Number(cfg.DB_PORT||5432),user:cfg.DB_USER,password:cfg.DB_PASS,database:'postgres'});let created=false;
(async()=>{
 try {
  run('runtime',process.execPath,['scripts/check-node-runtime.cjs']);
  run('locked-dependencies',process.execPath,[npm,'ci']);
  run('production-audit',process.execPath,[npm,'audit','--omit=dev','--audit-level=high']);
  await admin.connect();
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount)throw Error('Disposable database name collision; existing database preserved.');
  await admin.query('CREATE DATABASE "'+database+'"');created=true;
  await smoke('source-runtime',process.execPath,['app.js']);
  if(PROJECT==='RX-TRACKER') {
   for(const key of ['check:public-js','test:call-center-phone-client','test:call-center-shared-state','test:workflow-date','test:backoffice-patient-delete','test:service-window','test:patient-double-update','test:rx-override','test:call-center-queue-reopen','test:call-center-call-attempts','test:softphone-self-setup'])run(key.replaceAll(':','-'),process.execPath,[npm,'run',key]);
  }
  run('compiled-build',process.execPath,[npm,'run','build:exe']);
  const exe=path.join(root,'dist/server.exe');run('compiled-runtime-info',exe,['--runtime-info']);
  const info=JSON.parse(fs.readFileSync(path.join(output,'compiled-runtime-info.log'),'utf8').replace(/^\uFEFF/,''));
  if(info.node!=='22.23.4'||info.applicationVersion!==pkg.version)throw Error('Unpatched or mismatched compiled runtime.');
  await smoke('compiled-runtime',exe,[]);
  const zipName='server-update-'+pkg.version+'.zip';const zip=path.join(root,'dist',zipName);
  const verify=String.raw`import zipfile,sys,hashlib
z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None
for n in z.namelist():
 assert not n.startswith('/') and '..' not in n.replace('\\','/').split('/') and n.rsplit('/',1)[-1]!='.env', 'Unsafe ZIP entry'
assert hashlib.sha256(z.read('server.exe')).hexdigest()==hashlib.sha256(open(sys.argv[2],'rb').read()).hexdigest()
print('PASS safe ZIP and embedded executable parity')`;
  run('package-integrity','python',['-c',verify,zip,exe]);
  fs.copyFileSync(zip,path.join(output,zipName));
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');const hashes={[zipName]:hash(zip)};
  fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),hash(zip)+' *'+zipName+'\n'+hash(exe)+' *server.exe\n');
  if(git('rev-parse','HEAD')!==commit||git('status','--porcelain'))throw Error('Source changed during validation.');
  fs.writeFileSync(path.join(output,'LOCAL_VALIDATION.json'),JSON.stringify({project:PROJECT,version:pkg.version,sourceCommit:commit,localValidationPassed:true,checks,nodeVersion:process.version,embeddedRuntimes:{server:info},embeddedExecutableHashes:{'server.exe':hash(exe)},sha256:hashes},null,2));
  console.log('PASS local compiled release '+pkg.version+' from '+commit);
 }finally{
  if(created){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);await admin.query('DROP DATABASE "'+database+'"');}
  await admin.end();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
