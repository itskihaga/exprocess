import { CommandRecord, CreateRecordRepository, createStore, RecordRepository, RecordRepositoryListener, StoreLogic } from "."

type State = number
type Command = "ADD" | "SUBTRACT" | "RESET_NEGATIVE"
type Result = {
    type: "ADD" | "SUBTRACT" | "REPLACE"
    value: number
} | {
    type: "NOTHING"
}
const logic : (getNumber:() => number) => StoreLogic<State,Command,Result> = (getNumber) => ({
    initial:0,
    script(prev,command){
        switch (command) {
            case "ADD":
                return {
                    type:"ADD",
                    value:getNumber()
                }
            case "SUBTRACT":
                return {
                    type:"SUBTRACT",
                    value:getNumber()
                }
            case "RESET_NEGATIVE":
                return prev < 0 ? {type:"REPLACE",value:0} : {type:"NOTHING"}
        }
    },
    reducer(prev,result) {
        switch (result.type) {
            case "ADD":
                return prev + result.value
            case "SUBTRACT":
                return prev - result.value
            case "NOTHING":
                return prev
            case "REPLACE":
                return result.value
        }
    }
})


test("結果が正しく算出され、履歴がrepositoryに保存されている",async () => {
    let id = 0
    const storage :CommandRecord<Command, Result>[] = []
    const repository : RecordRepository<Command,Result> = {
        save(record){
            id = id + 1
            return {
                id:id.toString(),
                async exec(){
                    storage.push({
                        id:id.toString(),
                        ...record
                    })
                }
            }
        },
        unwatch(){}
    }
    let state = 0
    const store = createStore(
        logic(() => 1),
        (_,newState) => state = newState,
        () => repository,
    )
    await store.dispatch("ADD"); // +1
    await store.dispatch("ADD"); // +1
    await store.dispatch("SUBTRACT"); // -1
    await store.dispatch("ADD"); // + 1
    expect(state).toBe(2);
    expect(storage).toEqual([
        {"id":"1","result":{"type":"ADD","value":1},"command":"ADD"},
        {"id":"2","result":{"type":"ADD","value":1},"command":"ADD"},
        {"id":"3","result":{"type":"SUBTRACT","value":1},"command":"SUBTRACT"},
        {"id":"4","result":{"type":"ADD","value":1},"command":"ADD"}
    ])
})

test("repositoryの状態変化と同期される。その際、ローカルでdispatchされたrecordは再カウントされない",async () => {
    let id = 0
    const storage :CommandRecord<Command, Result>[] = []
    let changeRepoState : RecordRepositoryListener<Command, Result> = () => {
        
    }  
    let state = 0
    const createRepository : CreateRecordRepository<Command,Result> = (listener) => {
        changeRepoState = listener;
        return {
            save(record){
                id = id + 1
                return {
                    id:id.toString(),
                    async exec(){
                        storage.push({
                            id:id.toString(),
                            ...record
                        })
                    }
                }
            },
            unwatch(){}
        }
    }
    const store = createStore(
        logic(() => 1),
        (_,newState) => state = newState,
        createRepository,
    )
    await store.dispatch("ADD"); // +1 id:1
    await store.dispatch("ADD"); // +1 id:2
    changeRepoState([
        {command:"ADD",result:{type:"ADD",value:1},id:"1"},
        {command:"ADD",result:{type:"ADD",value:1},id:"2"},
        {command:"SUBTRACT",result:{type:"SUBTRACT",value:1},id:"3"}
    ])
    expect(state).toBe(1)

})