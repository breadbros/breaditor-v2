import assertType from 'assert'

//it's a kind of magic!
declare global {
  var assert: typeof assertType
}

type DocumentTypeType = 'MAP'|'SPRITE'|'TEXT';

type DocumentType  = {
  id: string, title: string, type: DocumentTypeType
}