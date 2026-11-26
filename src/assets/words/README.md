# Word lists for the word game

`de.json` and `en.json` hold two strings of 5-letter words written back to back (5 characters each, upper case):

- `sol`: the possible solutions, common words in a fixed shuffled order (the daily word walks through it)
- `valid`: every word accepted as a guess, sorted

## Sources

- Solutions (both languages) and extra German guesses: the 10 000 most common words per language from
  [most-common-words-by-language](https://github.com/oprogramador/most-common-words-by-language) (MIT),
  which is based on the OpenSubtitles frequency lists of [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (CC BY-SA 4.0).
- English frequency order: [subtlex-word-frequencies](https://github.com/words/subtlex-word-frequencies) (ISC).
- English guesses: [an-array-of-english-words](https://github.com/words/an-array-of-english-words) (MIT).
- German noun forms: [german-words-dict](https://github.com/RosaeNLG/rosaenlg) (CC BY-SA 4.0, based on german-pos-dict by LanguageTool and Morphy).

Because parts come from CC BY-SA 4.0 data, these two list files are shared under CC BY-SA 4.0 as well.
They were filtered to 5 letters (A–Z, Ä, Ö, Ü), proper names and a few offensive words were removed.
