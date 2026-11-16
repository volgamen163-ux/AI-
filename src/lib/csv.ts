export function parseCsv(input: string, maxRows=250):Record<string,string>[]{
 const text=input.replace(/^\uFEFF/,"");
 const head=text.split(/\r?\n/,1)[0]||"";
 const delimiter=[";",",","\t"].sort((a,b)=>head.split(b).length-head.split(a).length)[0];
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const x=text[i];
  if(x==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(x===delimiter&&!quoted){row.push(cell);cell="";}
  else if((x==='\r'||x==='\n')&&!quoted){row.push(cell);cell="";if(x==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x.trim()))rows.push(row);row=[];}
  else cell+=x;
 }
 if(quoted)throw new Error("Незакрытые кавычки в CSV");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw new Error("Нужны заголовки и хотя бы одна строка");
 if(rows.length>maxRows+1)throw new Error("Максимум "+maxRows+" строк");
 const cols=rows.shift()!.map(x=>x.trim().toLowerCase().replace(/\s+/g,""));
 if(new Set(cols).size!==cols.length)throw new Error("Повторяющиеся заголовки");
 return rows.map(r=>Object.fromEntries(cols.map((k,i)=>[k,(r[i]||"").trim()])));
}
export function field(r:Record<string,string>,aliases:string[]):string{
 for(const k of aliases){const v=r[k.toLowerCase().replace(/\s+/g,"")];if(v)return v;}return "";
}
