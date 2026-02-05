"""
Gemini API を使用したAI肌診断機能

Google Gemini 2.5 Flash を使用して肌診断を実行します。
参考: https://note.com/satoru666/n/n08e754f7313e
"""
import google.generativeai as genai
import json
from typing import Dict
from flask import current_app
from utils.image_processing import resize_and_compress_image, validate_image_data


def analyze_skin_with_gemini(image_data: str, gender: str = 'male') -> Dict:
    """
    Gemini 2.5 Flashで肌診断を実行
    
    Args:
        image_data: base64エンコードされた顔画像
        gender: ユーザーの性別（'male' or 'female'）
    
    Returns:
        dict: 診断結果
            {
                'skin_type': str,           # 肌タイプ
                'concerns': list,           # 肌悩みリスト
                'skin_age': int,            # 推定肌年齢
                'score': int,               # スコア（0-100）
                'general_advice': str,      # 一般向けアドバイス
                'expert_advice': str,       # 専門家向けアドバイス
                'error': bool               # エラーフラグ
            }
    """
    try:
        # 0. APIキーチェック（app.configから取得）
        api_key = current_app.config.get('GOOGLE_GEMINI_API_KEY')
        
        if not api_key:
            print("[Gemini] ⚠️ APIキーが未設定です")
            return {
                'error': True,
                'message': 'AI肌診断機能は現在利用できません。管理者がGemini APIキーを設定していない可能性があります。',
                'skin_type': 'unknown',
                'skin_type_jp': '不明',
                'concerns': [],
                'concerns_jp': [],
                'skin_age': 0,
                'score': 0,
                'general_advice': '現在AI診断機能はご利用いただけません。手動で肌診断フォームをご利用ください。',
                'expert_advice': ''
            }
        
        # Gemini APIを設定
        genai.configure(api_key=api_key)
        print(f"[Gemini] APIキー設定完了（app.config経由）")
        
        # 1. 画像データのバリデーション
        if not validate_image_data(image_data):
            return create_error_response("無効な画像データです")
        
        # 2. 画像を圧縮（Payload Too Large対策）
        try:
            compressed_image, metadata = resize_and_compress_image(image_data)
            print(f"[Gemini] 画像圧縮: {metadata['original_size']} → {metadata['compressed_size']} bytes ({metadata['compression_ratio']}% 削減)")
        except ValueError as e:
            return create_error_response(f"画像圧縮エラー: {str(e)}")
        
        # 3. Geminiモデル初期化
        try:
            model = genai.GenerativeModel(
                model_name='models/gemini-2.5-flash',  # 最新の高速モデル（2.5系）
                generation_config={
                    'temperature': 0.4,  # 一貫性重視
                    'top_p': 0.95,
                    'top_k': 40,
                    'max_output_tokens': 2048,
                    'response_mime_type': 'application/json',  # JSON形式で返答
                }
            )
        except Exception as e:
            return create_error_response(f"モデル初期化エラー: {str(e)}")
        
        # 4. プロンプト作成（性別に応じた内容）
        gender_context = "女性" if gender == 'female' else "男性"
        gender_specific_advice = """
【女性向けアドバイス】
- メイク（ファンデーション、コンシーラー、パウダー）の推奨
- スキンケア（化粧水、美容液、乳液、クリーム）の推奨
- 化粧品成分の具体的な提案
""" if gender == 'female' else """
【男性向けアドバイス】
- シンプルなスキンケア（洗顔、化粧水、保湿）の推奨
- 清潔感を保つためのグルーミング
- 手軽に続けられるケア方法
"""
        
        prompt = f"""
あなたは経験豊富な皮膚科医です。この{gender_context}の顔写真を詳細に分析し、第一印象を良くするための肌診断を行ってください。

【分析項目】
1. 肌タイプ（以下のいずれか）
   - "乾燥肌" (dry)
   - "脂性肌" (oily)
   - "混合肌" (combination)
   - "普通肌" (normal)

2. 主な肌悩み（該当するものすべて）
   - "毛穴" (pores)
   - "黒ずみ" (dark_spots)
   - "ニキビ" (acne)
   - "シワ" (wrinkles)
   - "色素沈着" (pigmentation)
   - "肌トーン不均一" (uneven_tone)
   - "乾燥" (dryness)
   - "テカリ" (oiliness)

3. 推定肌年齢（数値）

4. 総合スコア（0-100点）
   - 清潔感、ハリ、ツヤ、透明感などを総合評価
   - 50点が平均、70点以上が良好

【アドバイス内容】
{gender_specific_advice}

【出力形式】
必ず以下のJSON形式で出力してください。改行や特殊文字は使用せず、1行で記述してください：
{{
  "skin_type": "肌タイプ（日本語）",
  "skin_type_en": "肌タイプ（英語キー）",
  "concerns": ["悩み1", "悩み2"],
  "concerns_en": ["concern1_en", "concern2_en"],
  "skin_age": 推定年齢（数値）,
  "score": スコア（0-100の数値）,
  "general_advice": "一般向けのわかりやすいアドバイス。3-4文で簡潔に。",
  "expert_advice": "専門家向けの詳細なアドバイス。5-6文で科学的根拠を含めて。"
}}

【JSON出力の重要なルール】
1. すべてのテキストは1行で記述（改行禁止）
2. 文章中のダブルクォートは使用しない
3. 特殊文字（\n, \t, \r など）は使用しない
4. JSON以外のテキストは一切含めない
5. コードブロック（```）も不要

【重要な注意事項】
- 必ず正直に、専門家として厳格に評価してください
- 褒めるだけではなく、改善点も具体的に指摘してください
- 一般向けアドバイスは優しく、専門家向けは科学的に記述してください
"""
        
        # 5. API呼び出し
        try:
            # base64データから画像部分を抽出
            image_b64 = compressed_image.split(',')[1]
            
            response = model.generate_content([
                prompt,
                {
                    'mime_type': 'image/jpeg',
                    'data': image_b64
                }
            ])
            
            print(f"[Gemini] API呼び出し成功")
            
        except Exception as e:
            return create_error_response(f"API呼び出しエラー: {str(e)}")
        
        # 6. レスポンスをパース
        try:
            result_text = response.text.strip()
            print(f"[Gemini] レスポンス受信: {len(result_text)} 文字")
            
            # JSONの抽出（コードブロックがある場合）
            if '```json' in result_text:
                result_text = result_text.split('```json')[1].split('```')[0].strip()
                print(f"[Gemini] json コードブロックから抽出")
            elif '```' in result_text:
                result_text = result_text.split('```')[1].split('```')[0].strip()
                print(f"[Gemini] コードブロックから抽出")
            
            # JSON文字列のクリーニング
            # 制御文字を削除（改行、タブなど）
            result_text = result_text.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
            
            # 連続するスペースを1つにまとめる
            import re
            result_text = re.sub(r'\s+', ' ', result_text)
            
            print(f"[Gemini] クリーニング後: {result_text[:200]}...")
            
            # JSONパース
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError as e:
                # パースに失敗した場合、より詳細なエラー情報を出力
                print(f"[Gemini] JSONパース失敗。エラー箇所周辺:")
                error_pos = e.pos if hasattr(e, 'pos') else 0
                start = max(0, error_pos - 50)
                end = min(len(result_text), error_pos + 50)
                print(f"[Gemini] ...{result_text[start:end]}...")
                
                # 手動でJSONを修正して再試行
                # ダブルクォートのエスケープ問題を修正
                result_text_fixed = result_text.replace('\\"', '"').replace('""', '"')
                result = json.loads(result_text_fixed)
            
            # データの正規化
            normalized_result = {
                'skin_type': result.get('skin_type_en', result.get('skin_type', 'unknown')),
                'skin_type_jp': result.get('skin_type', '不明'),
                'concerns': result.get('concerns_en', result.get('concerns', [])),
                'concerns_jp': result.get('concerns', []),
                'skin_age': int(result.get('skin_age', 0)),
                'score': int(result.get('score', 0)),
                'general_advice': result.get('general_advice', ''),
                'expert_advice': result.get('expert_advice', ''),
                'error': False
            }
            
            print(f"[Gemini] 診断完了: スコア={normalized_result['score']}点, 肌タイプ={normalized_result['skin_type']}")
            return normalized_result
            
        except json.JSONDecodeError as e:
            print(f"[Gemini] ❌ JSONパースエラー: {str(e)}")
            print(f"[Gemini] エラー行: {e.lineno if hasattr(e, 'lineno') else '不明'}")
            print(f"[Gemini] エラー列: {e.colno if hasattr(e, 'colno') else '不明'}")
            print(f"[Gemini] レスポンステキスト全文:")
            print(f"[Gemini] {result_text[:1000]}")
            return create_error_response(f"レスポンス解析エラー: {str(e)}")
        except Exception as e:
            print(f"[Gemini] ❌ 予期しないパースエラー: {str(e)}")
            print(f"[Gemini] レスポンステキスト: {result_text[:500]}")
            return create_error_response(f"データ解析エラー: {str(e)}")
        
    except Exception as e:
        print(f"[Gemini] 予期しないエラー: {str(e)}")
        return create_error_response(f"診断エラー: {str(e)}")


def create_error_response(message: str) -> Dict:
    """
    エラーレスポンスを生成
    
    Args:
        message: エラーメッセージ
    
    Returns:
        dict: エラーレスポンス
    """
    return {
        'error': True,
        'message': message,
        'skin_type': 'unknown',
        'skin_type_jp': '不明',
        'concerns': [],
        'concerns_jp': [],
        'skin_age': 0,
        'score': 0,
        'general_advice': 'エラーが発生しました。もう一度お試しください。',
        'expert_advice': ''
    }


# テスト用関数
if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    
    print("Gemini AI 肌診断 テスト")
    print("-" * 50)
    
    # テスト用に直接環境変数から読み込み
    load_dotenv()
    api_key = os.getenv('GOOGLE_GEMINI_API_KEY')
    
    if not api_key:
        print("✗ エラー: GOOGLE_GEMINI_API_KEY が設定されていません")
        print("  .env ファイルにAPIキーを設定してください")
    else:
        print("✓ APIキー設定済み")
        print(f"  APIキー: {api_key[:10]}...")
        print("\n注意: このスクリプトを直接実行する場合は、Flaskアプリケーションコンテキスト外なので")
        print("      analyze_skin_with_gemini() は使用できません。")
        print("      Flask経由でテストしてください。")
