import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import XLSX from "xlsx";

const [zoneFile,qgisFile,cadastroFile]=process.argv.slice(2);
if(!zoneFile||!qgisFile||!cadastroFile)throw new Error("Informe as três planilhas cadastrais.");
const output=path.resolve("public/consultation-data");
const clean=v=>String(v??"").trim();
const digits=v=>clean(v).replace(/\D/g,"");
const search=v=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const read=file=>{const wb=XLSX.readFile(file,{cellDates:false});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:"",raw:false});};
const zoneRows=read(zoneFile),qgisRows=read(qgisFile),cadastroRows=read(cadastroFile);
const zoneMap=new Map(zoneRows.map(r=>[digits(r.inscricao),clean(r.Zona)]).filter(([k])=>k));
const qgisMap=new Map();
for(const r of qgisRows){const k=digits(r.cadastro);if(k&&!qgisMap.has(k))qgisMap.set(k,r);}
const master=Array.from({length:64},()=>[]),indexes={registration:new Map(),owner:new Map(),address:new Map(),identifier:new Map(),territory:new Map()};
const hash=value=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return String((h>>>0)%64).padStart(2,"0");};
const add=(mode,key,shard,id)=>{const normalized=mode==="registration"?digits(key):search(key);const min=mode==="registration"?4:2;if(normalized.length<min)return;const prefix=normalized.slice(0,min);const bucket=indexes[mode].get(prefix)??[];bucket.push([normalized,shard,id]);indexes[mode].set(prefix,bucket);};
let id=0;
for(const r of cadastroRows){const registration=clean(r["inscrição"]??r.inscricao);if(!registration)continue;const cadastral=digits(r.cadastro),q=qgisMap.get(cadastral)??{};const baseRegistration=registration.split(".").slice(0,3).join(".");const record={id:String(++id),registration,baseRegistration,zone:zoneMap.get(digits(baseRegistration))??"",propertyType:clean(r.tipo),owner:clean(r["proprietário"]??r.proprietario),document:clean(r["cpf/cnpj"]),neighborhood:clean(r.bairro),street:clean(r.logradouro),number:clean(r["numeração"]??r.numeracao),postalCode:clean(r.Cep??r.cep),block:clean(r.Quadra??r.quadra),lot:clean(r.Lote??r.lote),qgisNumber:clean(q.numeracaocorreta),onSiteNumber:clean(q.numeracaoinloco),cadastralNumber:clean(q.numerocadastroimobiliario),numberingStatus:clean(q.situacao),side:clean(q.lado),parity:clean(q.par_impar),initialRange:clean(q.faixainicial),finalRange:clean(q.faixafinal),qgisObservation:clean(q.observacao)};const shard=hash(registration);master[Number(shard)].push(record);add("registration",registration,shard,record.id);add("owner",record.owner,shard,record.id);for(const value of [record.street,`${record.street} ${record.number}`,`${record.neighborhood} ${record.street} ${record.number}`])add("address",value,shard,record.id);for(const value of [cadastral,record.document,record.postalCode,record.cadastralNumber])add("identifier",value,shard,record.id);for(const value of [record.neighborhood,record.block,`quadra ${record.block}`,record.lot,`lote ${record.lot}`,record.zone,`${record.neighborhood} ${record.zone}`])add("territory",value,shard,record.id);}
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
const write=async(relative,value)=>{const target=path.join(output,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,gzipSync(Buffer.from(JSON.stringify(value)),{level:9}));};
await Promise.all(master.map((records,index)=>write(`master/${String(index).padStart(2,"0")}.json.gzbin`,records)));
for(const [mode,buckets] of Object.entries(indexes))await Promise.all([...buckets].map(([prefix,entries])=>write(`${mode}/${prefix}.json.gzbin`,entries)));
const manifest={generatedAt:new Date().toISOString(),records:id,zoneRows:zoneRows.length,qgisRows:qgisRows.length,masterShards:64,modes:{registration:{label:"Inscrição imobiliária",minimum:4,prefixSize:4},owner:{label:"Proprietário",minimum:2,prefixSize:2},address:{label:"Endereço",minimum:2,prefixSize:2},identifier:{label:"Cadastro, CPF/CNPJ ou CEP",minimum:2,prefixSize:2},territory:{label:"Bairro, quadra, lote ou zona",minimum:2,prefixSize:2}}};
await fs.writeFile(path.join(output,"manifest.json"),JSON.stringify(manifest));console.log(JSON.stringify(manifest,null,2));
