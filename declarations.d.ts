declare module "react-native-text-recognition" {
  const TextRecognition: {
    recognize: (uri: string) => Promise<string[]>;
  };
  export default TextRecognition;
}