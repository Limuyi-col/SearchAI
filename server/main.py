from flask import Flask, request, jsonify
from flask_cors import CORS
# from transformers import pipeline
from transformers import AutoModelForCausalLM, AutoTokenizer

app = Flask(__name__)
CORS(app)


class SearchAI:
    def __init__(self, model_pth="/home/lwl/lwl/models/Qwen2.5-7B-Instruct"):
        self.model_pth = model_pth
        self.model = None
        self.tokenizer = None
        self.model_init()

    def model_init(self):
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype="auto",
            device_map="auto"
        )
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)

    def make_prompt(self, query='', searchResults=''):
        system_prompt = f'''
                        You are an intelligent assistant helping users make sense of online search results. Your task is to summarize the search results and provide a clear and concise response to the user's query.

                        User's query:
                        "{{query}}"
                        
                        Relevant search results:
                        {{searchResults}}
                        
                        Using the information above:
                        1. Summarize the key points from the search results that are most relevant to the query.
                        2. Provide a clear and helpful response to the user's query based on the summarized information.
                        3. If no relevant information is found, suggest next steps or clarify ambiguities in the query.

                '''
        context = system_prompt.replace("{{query}}", query).replace("{{searchResults}}", searchResults)
        return context

    def generate_response(self, query, searchContext):
        context = self.make_prompt(query, searchContext)
        input_ids = self.tokenizer.encode(context, return_tensors="pt").to("cuda")
        resp_start = len(input_ids)
        output = self.model.generate(input_ids, max_length=512, num_return_sequences=1)
        return self.tokenizer.decode(output[0][resp_start:], skip_special_tokens=True)

@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    query = data.get('query', '')

    if isinstance(query, dict):
        query = query.get('query', '')
        searchContext = data.get('searchResults', '')

        if not searchContext:
            return jsonify({"result": "搜索结果为空！"}), 400
    else:
        searchContext = ''

    if not query:
        return jsonify({"result": "输入内容为空！"}), 400

    print("query: ", query)
    print("searchContext: ", searchContext)

    # 使用模型生成结果
    response = search_ai.generate_response(query, searchContext)
    # response = generate_response(query)
    return jsonify({"result": response})

if __name__ == '__main__':
    # 初始化模型
    # model = pipeline("text-generation", model="/home/lwl/lwl/models/Qwen2.5-7B-Instruct")
    model_name = "/home/lwl/lwl/models/Qwen2.5-7B-Instruct"
    search_ai = SearchAI(model_name)

    app.run(host='0.0.0.0', port=5000)
