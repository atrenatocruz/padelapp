import { Link } from 'react-router-dom'
import { ArrowLeft, HelpCircle, Users, Calendar, Trophy, Settings } from 'lucide-react'
import { Wordmark } from '../components/Layout'

export default function Instructions() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="text-ink-700">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-ink-900">Instruções</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center mb-8">
          <HelpCircle size={48} className="mx-auto text-ink-700 mb-4" />
          <h2 className="text-3xl font-bold text-ink-900 mb-2">
            Como usar a <Wordmark variant="light" className="h-8 inline-block align-middle" />
          </h2>
          <p className="text-gray-600">Instruções rápidas para começar</p>
        </div>

        {/* Main Instructions Card */}
        <div className="card space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Abre a app (ou site) no teu telemóvel.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
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
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Clica em <strong>Criar conta</strong> — e estás dentro! Guarda bem a tua password.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Na página principal, vês a lista de jogos.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
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
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                6
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Cada mix tem <strong>campos × 4 jogadores</strong> (ex.: 2 campos = 8 jogadores).
                  Quando enche, verás{' '}
                  <strong className="text-green-600">Mix fechado — campo reservado</strong> e
                  deixa de aceitar inscrições.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                7
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  No teu <strong>Perfil</strong>, define o teu <strong>lado preferido</strong>{' '}
                  (Esquerda, Direita ou Ambos) — é usado para formar as duplas: quem entra sozinho
                  é emparelhado juntando um jogador de esquerda com um de direita.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                8
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Quando o mix está cheio, o admin clica em <strong>Começar o jogo</strong>: as
                  duplas são formadas, as rondas calculadas (tempo do court ÷ tempo de jogo) e os
                  jogos sorteados pelos campos conforme o formato.
                </p>
                <ul className="mt-2 space-y-1 ml-4">
                  <li className="text-gray-600">
                    • <strong>Sobe e desce:</strong> quem ganha sobe um campo, quem perde desce.
                    Vence o mix a dupla que ganhar no campo 1 na última ronda.
                  </li>
                  <li className="text-gray-600">
                    • <strong>Todos contra todos:</strong> cada dupla joga contra todas as outras;
                    se sobrarem rondas, há fase eliminatória (meias-finais / final).
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 bg-ink-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                9
              </div>
              <div>
                <p className="text-gray-700 leading-relaxed">
                  Durante o mix, o admin regista o resultado de <strong>cada jogo</strong> (não há
                  empates). No sobe e desce só se avança de ronda com os resultados todos
                  submetidos. No fim, o admin clica em <strong>Finalizar jogo</strong> e o ranking
                  atualiza: vitórias/derrotas de jogos por jogador e <strong>+1 vitória de mix</strong>{' '}
                  para a dupla vencedora.
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
            <Calendar size={32} className="text-ink-700 mb-3" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Ver jogos</h3>
            <p className="text-gray-600">
              Na página inicial vês todos os jogos disponíveis. Clica num jogo para ver detalhes.
            </p>
          </div>

          <div className="card">
            <Users size={32} className="text-ink-700 mb-3" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Entrar em jogos</h3>
            <p className="text-gray-600">
              Escolhe se queres jogar sozinho ou com parceiro. Receberás confirmação automática.
            </p>
          </div>

          <div className="card">
            <Trophy size={32} className="text-ink-700 mb-3" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Ver ranking</h3>
            <p className="text-gray-600">
              O ranking mostra, por jogador: <strong>mixes ganhos</strong> (vitórias de mix) e{' '}
              <strong>vitórias/derrotas de jogos</strong> (cada jogo individual dentro dos mixes).
            </p>
          </div>

          <div className="card">
            <Settings size={32} className="text-ink-700 mb-3" />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Editar perfil</h3>
            <p className="text-gray-600">
              Atualiza o teu nome, contacto e nível de jogo na página de perfil.
            </p>
          </div>
        </div>

        {/* Admin Guide */}
        <div className="card bg-blue-50 border-2 border-blue-200">
          <h3 className="text-xl font-bold text-ink-900 mb-4">
            📋 Guia para Administradores
          </h3>
          <div className="space-y-3 text-gray-700">
            <p>
              <strong>Para criar um mix:</strong> "Criar novo jogo" → define título, data, local,{' '}
              <strong>nº de campos</strong> (jogadores = campos × 4), <strong>tempo do court</strong>,{' '}
              <strong>tempo de jogo</strong> (rondas = court ÷ jogo) e o <strong>formato</strong>{' '}
              (sobe e desce ou todos contra todos).
            </p>
            <p>
              <strong>Para arrancar o mix:</strong> quando estiver cheio, abre o jogo e clica{' '}
              <strong>Começar o jogo</strong> — as duplas e o sorteio são automáticos.
            </p>
            <p>
              <strong>Durante o mix:</strong> regista o resultado de cada jogo, avança as rondas
              e no fim clica <strong>Finalizar jogo</strong> para atualizar o ranking.
            </p>
            <p>
              <strong>Para gerir membros:</strong> Acede ao painel Admin para ver todos os
              jogadores e promover novos admins.
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

