// A delegated worker can use a full 210-second native turn. Preserve the existing
// single-agent recovery/review allowance and reserve a turn for each extra worker.
export function missionBudgetMs(assignments=1){
 if(!Number.isInteger(assignments)||assignments<1||assignments>3)throw Error('A mission requires one to three assignments.');
 return 600000+(assignments-1)*210000;
}
