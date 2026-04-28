const ort = require('onnxruntime-node');

async function main() {
    try {
        const session = await ort.InferenceSession.create('c:\\Users\\USER\\.gemini\\antigravity\\scratch\\AI_Terminal_V2\\public\\nas100_brain_web.onnx');
        
        console.log("Inputs:");
        session.inputNames.forEach(name => {
            console.log(`- ${name}`);
        });
        
        console.log("Input Names:", session.inputNames);
        console.log("Output Names:", session.outputNames);
        
    } catch (e) {
        console.error(e);
    }
}
main();
