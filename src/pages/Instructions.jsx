import { Link } from 'react-router-dom'
import { ArrowLeft, HelpCircle, Users, Calendar, Trophy, Settings } from 'lucide-react'
import { Wordmark } from '../components/Layout'

export default function Instructions() {
  return (
    <div className="min-h-screen bg-apple-gray">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-apple-blue">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-apple-darkgray">Instruções</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center mb-8">
          <HelpCircle size={48} className="mx-auto text-apple-blue mb-4" />
          <h2 className="text-3xl font-bold text-apple-darkgray mb-2">
            Como usar a <Wordmark />
          </h2>
          <p className="text-gray-600">Instruções rápidas para começar</p>
        </div>

        {/* Main Instructions Card */}
        <div className="card space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Abre a app (ou site) no teu telemóvel.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Clica em <strong>Criar Conta</strong>: preenche o teu nome, email, data de nascimento, 
                  género e cria uma password.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Clica em <strong>Criar conta</strong> — e estás dentro! Guarda bem a tua password.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Na página principal, vês a lista de jogos.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                5
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Para entrares num jogo, clica em <strong>Quero jogar</strong>.
                </p>
                <ul className="mt-2 space-y-1 ml-4">
                  <li className="text-gray-600">
                    • Se tens parceiro: escolhe <strong>Entrar com parceiro</strong> e confirma o nome.
                  </li>
                  <li className="text-gray-600">
                    • Se não tens: escolhe <strong>Entrar sozinho</strong> — o sistema tenta arranjar parceiro.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                6
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Quando 4 pessoas confirmarem, o jogo fecha automaticamente: verás{' '}
                  <strong className="text-green-600">Jogo fechado — campo reservado</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                7
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  No fim do jogo, abre o jogo e clica em <strong>Registar resultado</strong> — 
                  escolhe o resultado e confirma.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                8
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Se fores o administrador, vai à página <strong>Admin</strong> para criar novos 
                  jogos ou confirmar resultados.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                9
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Para trocar o logótipo: Admin → Definições → Carregar logo.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mt-6">
            <p className="text-gray-700 leading-relaxed">
              <strong>💡 Dica:</strong> Se algo não funcionar: faz um print e envia por WhatsApp 
              a um dos fundadores. Guarda o link do site para aceder facilmente.
            </p>
          </div>
        </div>

        {/* Quick Guide Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card">
            <Calendar size={32} className="text-apple-blue mb-3" />
            <h3 className="text-lg font-semibold text-apple-darkgray mb-2">Ver jogos</h3>
            <p className="text-gray-600">
              Na página inicial vês todos os jogos disponíveis. Clica num jogo para ver detalhes.
            </p>
          </div>

          <div className="card">
            <Users size={32} className="text-apple-blue mb-3" />
            <h3 className="text-lg font-semibold text-apple-darkgray mb-2">Entrar em jogos</h3>
            <p className="text-gray-600">
              Escolhe se queres jogar sozinho ou com parceiro. Receberás confirmação automática.
            </p>
          </div>

          <div className="card">
            <Trophy size={32} className="text-apple-blue mb-3" />
            <h3 className="text-lg font-semibold text-apple-darkgray mb-2">Ver ranking</h3>
            <p className="text-gray-600">
              Consulta a tua posição e estatísticas no ranking do grupo.
            </p>
          </div>

          <div className="card">
            <Settings size={32} className="text-apple-blue mb-3" />
            <h3 className="text-lg font-semibold text-apple-darkgray mb-2">Editar perfil</h3>
            <p className="text-gray-600">
              Atualiza o teu nome, contacto e nível de jogo na página de perfil.
            </p>
          </div>
        </div>

        {/* Admin Guide */}
        <div className="card bg-blue-50 border-2 border-blue-200">
          <h3 className="text-xl font-bold text-apple-darkgray mb-4">
            📋 Guia para Administradores
          </h3>
          <div className="space-y-3 text-gray-700">
            <p>
              <strong>Para criar um mix:</strong> Clica em "Criar jogo", escolhe dia e hora e 
              carregue em "Guardar".
            </p>
            <p>
              <strong>Para gerir membros:</strong> Acede ao painel Admin para ver todos os 
              jogadores e promover novos admins.
            </p>
            <p>
              <strong>Para confirmar resultados:</strong> Podes ver e confirmar resultados 
              submetidos pelos jogadores.
            </p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="card text-center">
          <p className="text-gray-600">
            Precisas de ajuda? Contacta os administradores do grupo.
          </p>
        </div>
      </main>
    </div>
  )
}

