export class RuntimeContext{
 constructor(db,invalidate=()=>{}){this.db=db;this.onInvalidate=invalidate;}
 get epoch(){return Number(this.db.prepare("SELECT value FROM meta WHERE key='runtime_epoch'").get()?.value||0);}
 invalidate(){this.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('runtime_epoch',?)").run(String(this.epoch+1));this.db.prepare("DELETE FROM meta WHERE key='runtime_signature'").run();this.db.prepare('DELETE FROM checks').run();this.onInvalidate();}
 observe(route){if(!route)return this.epoch;const signature=JSON.stringify(route),before=this.db.prepare("SELECT value FROM meta WHERE key='runtime_signature'").get()?.value;if(before&&before!==signature)this.invalidate();this.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('runtime_signature',?)").run(signature);return this.epoch;}
}
