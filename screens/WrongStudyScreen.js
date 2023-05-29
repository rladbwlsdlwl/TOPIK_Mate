import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

import firestore from '@react-native-firebase/firestore';

import WrongProb from './component/WrongProb';


// route.params.key = {"select", "random", "write"}
// route.params.userTag로 유형을 나눔

// write인 경우 userTag, order
// select, random인 경우 userTag 

const WrongStudyScreen = ({route, navigation}) =>{
    // 백엔드에서 불러온 json 문제
    const [loadedProblem, setLoadedProblem] = useState([]); // json
    // 다음 문제를 넘길 때 사용
    const [nextBtn, setNextBtn] = useState(route.params.order);
    const [correct, setCorrect] = useState(0);

    const choiceRef = useRef(0);

    // 유저 답안 기록
    const answerRef = useRef([]);

    // 현재 userTag의 인덱스를 가르킴 ex. [{tagName: 001, section: "LS_TAG"} ,{tagName: 003, section: "LS_TAG"}, {tagName: 002, section: "RD_TAG"}]
    const typeRef = useRef(0);
    // 로드한 데이터의 마지막 문제를 가르킴
    const lastVisible = useRef(null);

    
    // 유저의 복습하기 콜렉션을 load
    const querySnapshot = route.params.querySnapshot
    const wrongCollection = (route.params.key !== "write") ? (querySnapshot.doc(route.params.userInfo.userId).collection(`wrong_lv${route.params.userInfo.myLevel}`)) : null
    

    useEffect(()=>{
        if(route.params.key == "select" || route.params.key == "random"){ 
            loadProblem()
        }else if(route.params.key =="write"){
            allLoadProblem();
        }

        return () => {
            console.log("복습하기 화면에서 나감")
            /* 
                풀었는데 맞은 문제 LIST: [
                    {
                        PRB_ID(document ID, primary key): 
                        tagName: 
                        section: 
                    }, ...
                ]

                - LIST에 있는 문제들을 wrong collection에서 제거
            */
        }
    }, [])


    // 쓰기 영역 - 최대 10문제를 한번에 불러옴
    const allLoadProblem = () =>{
        
        async function dataLoading(){
            try{
                let problemList = []
                const data = await querySnapshot.get(); // 요청한 데이터가 반환되면 다음 줄 실행
                
                data.docs.forEach((doc) => {if(doc._data.date) problemList.push(doc._data)})
            
                setLoadedProblem(problemList)
            }catch(error){
                console.log(error.message);
            }    
        }

        dataLoading();
    }


    // 듣기, 읽기 영역 - 한 유형에 대해 5문제씩 불러옴
    const loadProblem = () =>{
        async function dataLoading(){
            try{
                // 1. startAfter 사용시 orderBy와 함께 사용
                // 2. where절에서 지정한 column과 orderBy에서 지정한 column은 동일한 column을 가져야 함
                // 3. where에서는 범위를 지정해야 한다. (== 연산자 사용 불가)
                const data = (lastVisible.current) ? (
                    await wrongCollection.doc(route.params.userTag[typeRef.current].section).collection("PRB_TAG").doc(route.params.userTag[typeRef.current].tagName).collection("PRB_LIST")
                        .where("PRB_ID", ">=", "").orderBy("PRB_ID").startAfter(lastVisible.current).limit(5).get()) : (
                    await wrongCollection.doc(route.params.userTag[typeRef.current].section).collection("PRB_TAG").doc(route.params.userTag[typeRef.current].tagName).collection("PRB_LIST")
                        .where("PRB_ID", ">=", "").orderBy("PRB_ID").limit(5).get())
                    


                let rawData = data.docs.map((doc, index)=> {return {...doc.data()}})
                
                if(rawData.length == 0){ 
                    typeRef.current++ // 다른 유형의 문제를 load

                    if(typeRef.current>=route.params.userTag.length){  // 유저가 선택한 모든 유형의 문제를 푼 경우
                        setNextBtn(-1)
                        console.log("모든 문제를 풀었습니다.")

                        return 
                    }
                
                    const data = await wrongCollection.doc(route.params.userTag[typeRef.current].section).collection("PRB_TAG").doc(route.params.userTag[typeRef.current].tagName).collection("PRB_LIST")
                        .where("PRB_ID", ">=", "").orderBy("PRB_ID").limit(5).get()

                    rawData = data.docs.map((doc, index)=> {return {...doc.data()}})
                }

                
                lastVisible.current = rawData[rawData.length-1].PRB_ID
                setLoadedProblem([...loadedProblem, ...rawData])
            }catch(error){
                console.log(error.message);
            }    
        }

        dataLoading();
    }


    useEffect(()=>{
        if(route.params.key === "write"){
            return 
        }else if(nextBtn === -1){ // 모든 문제를 풀었을 경우
            let correct_answ = 0; 
            answerRef.current.forEach((data, index)=>{
               if(data.PRB_USER_ANSW == loadedProblem[index].PRB_CORRT_ANSW){
                    correct_answ++
                }
            })

            setCorrect(correct_answ)
            return
        }

        if(nextBtn == loadedProblem.length && nextBtn > 0){ // 문제를 다 풀었을 경우, 더 가져옴
            loadProblem()
        }
        if(nextBtn > 0 && loadedProblem[nextBtn-1].choice===undefined){ // 다음 문제를 풀기 전전 유저 답안을 기록
            answerRef.current.push({PRB_USER_ANSW: choiceRef.current})
            loadedProblem[nextBtn-1].choice = answerRef.current[nextBtn-1].PRB_USER_ANSW
        }
        

        if(nextBtn >= 0 && loadedProblem.length){
            console.log(loadedProblem[nextBtn])
        }
        choiceRef.current = 0;


    }, [nextBtn])

    return (
        <View style = {{flex: 1}}>
            {   
                (nextBtn == -1) ? (
                    <View style = {{flex: 1, padding: 14, alignItems: "center", justifyContent: "space-between"}}>
                        <View style = {{marginTop: 32}}>
                            <Text style = {[styles.text, {fontSize: 20}]}>
                                이번 학습에서 문제 {correct}개를 풀었습니다    
                            </Text>
                        </View>
                        <View style = {{width: 250, height: 250, borderRadius: 125, borderColor: "#BBD6B8", borderWidth: 5, alignItems: "center", justifyContent: "center"}}>
                            <Text style = {[styles.text, {fontSize: 32}]}>
                                {correct} / {answerRef.current.length}
                            </Text>
                        </View>
                        <Text style = {[styles.text, {fontSize: 20}]}>
                            잘하고 있어요!    
                        </Text>

                        <TouchableOpacity onPress = {() => navigation.navigate("Wrong")} style = {{backgroundColor: "#94AF9F", padding: 20, borderRadius: 20, width: 300}}>
                            <Text style = {[styles.text, {color: "white"}]}>
                                END LEARNING
                            </Text>
                        </TouchableOpacity>
                    </View>
                ): 
                ((loadedProblem.length && nextBtn < loadedProblem.length) ? 
                        <WrongProb 
                            problem = {loadedProblem[nextBtn]}
                            nextBtn = {nextBtn}
                            setNextBtn = {setNextBtn}
    
                            choiceRef = {choiceRef}
                            key = {nextBtn}

                            section = {route.params.key}
                            size = {loadedProblem.length}
                        />
                    : null) 
            }
            
        </View>
    );
}


const styles = StyleSheet.create({
    container:{
        padding: 20,
    },

    text:{
        textAlign: "center", 
        fontWeight: "bold",

    }
})



export default WrongStudyScreen;