// Finale checks preserve successful completion after its checkpoint is archived.
export const challengeCompleted=(number,value,finale)=>value?.state==='completed'||finale?.checks?.[number-1]===true;
