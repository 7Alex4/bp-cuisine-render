import Link from 'next/link'
import { headers } from 'next/headers'
import {
  getAutoCameraPresetLabel,
  getCameraAngleLabel,
  getImplantationLabel,
  getPreviewDeliveryLabel,
  getPreviewShellLabel,
  getRenderAmbienceLabel,
  getRenderQualityLabel,
  getVisualDossierSummary,
} from '@/lib/studio/project-summary'
import { summarizeRoomPhotoReferences, validateSiteSurvey } from '@/lib/studio/schema'
import type {
  RoomPhotoReference,
  SiteSurveyOpeningSpec,
  SiteSurveyUsefulHeightSpec,
  StudioProjectRecord,
  SurveyEquipmentType,
  SurveyHoodMode,
  WallId,
} from '@/lib/studio/schema'

export const dynamic = 'force-dynamic'

const EQUIPMENT_LABELS: Record<SurveyEquipmentType, string> = {
  sink: 'Evier',
  hob: 'Plaque de cuisson',
  oven: 'Four',
  fridge: 'Refrigerateur',
  dishwasher: 'Lave-vaisselle',
  hood: 'Hotte',
}

const WALL_LABELS: Record<WallId, string> = {
  north: 'Nord',
  east: 'Est',
  south: 'Sud',
  west: 'Ouest',
}

const HOOD_LABELS: Record<SurveyHoodMode, string> = {
  unknown: '',
  evacuation: 'Evacuation exterieure',
  recycling: 'Recyclage',
}

const ROOM_PHOTO_CATEGORY_LABELS: Record<string, string> = {
  piece: 'Piece',
  mur: 'Mur (general)',
  'mur-nord': 'Mur nord',
  'mur-est': 'Mur est',
  'mur-sud': 'Mur sud',
  'mur-ouest': 'Mur ouest',
  sol: 'Sol',
  plafond: 'Plafond',
  'detail-technique': 'Detail technique',
  'detail-finition': 'Detail finition',
  autre: 'Autre',
}

const CHECKLIST_ITEMS = [
  { key: 'dimensionsVerified', label: 'Dimensions piece verifiees' },
  { key: 'heightsVerified', label: 'Sous-hauteurs verifiees' },
  { key: 'openingsVerified', label: 'Ouvertures verifiees' },
  { key: 'technicalVerified', label: 'Contraintes techniques verifiees' },
  { key: 'clientNeedsVerified', label: 'Besoins client valides' },
  { key: 'finishesVerified', label: 'Finitions generiques validees' },
  { key: 'photosVerified', label: 'Photos et croquis recuperes' },
] as const

type PrintableSurveyPageProps = {
  searchParams: Promise<{ projectId?: string | string[] }>
}

type LoadProjectResult = {
  project: StudioProjectRecord | null
  error: string | null
}

async function buildProjectApiUrl(projectId: string): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')

  if (!host) {
    throw new Error('Host manquant pour charger le projet')
  }

  const protocol =
    headerList.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')

  return `${protocol}://${host}/api/studio/projects/${projectId}`
}

async function loadProject(projectId?: string): Promise<LoadProjectResult> {
  if (!projectId) {
    return { project: null, error: null }
  }

  try {
    const apiUrl = await buildProjectApiUrl(projectId)
    const response = await fetch(apiUrl, { cache: 'no-store' })
    const body = (await response.json()) as { project?: StudioProjectRecord; error?: string }

    if (!response.ok || !body.project) {
      return {
        project: null,
        error: body.error || 'Impossible de charger le projet demande.',
      }
    }

    return { project: body.project, error: null }
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function formatMillimeters(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return `${Math.round(value * 1000)} mm`
}

function formatWall(value: WallId | 'unknown'): string {
  return value === 'unknown' ? '' : WALL_LABELS[value]
}

function formatWalls(values: WallId[]): string {
  if (values.length === 0) return ''
  return values.map((wall) => WALL_LABELS[wall]).join(', ')
}

function formatYesNo(value: boolean): string {
  return value ? 'Oui' : 'Non'
}

function padRows<T>(rows: T[], minimum: number, createEmpty: () => T): T[] {
  const nextRows = [...rows]
  while (nextRows.length < minimum) {
    nextRows.push(createEmpty())
  }
  return nextRows
}

function getQueryProjectId(projectId?: string | string[]): string | undefined {
  if (Array.isArray(projectId)) return projectId[0]
  return projectId
}

function FieldLine({
  label,
  value,
  widthClass = 'w-full',
}: {
  label: string
  value?: string
  widthClass?: string
}) {
  return (
    <div className={['flex items-end gap-3', widthClass].join(' ')}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5752] whitespace-nowrap">
        {label}
      </span>
      <div className="border-b border-[#7c746d] min-h-6 flex-1 px-1.5 pb-0.5 text-sm text-right text-[#201d1e]">
        {value || ''}
      </div>
    </div>
  )
}

function CheckboxItem({
  label,
  checked = false,
  note,
}: {
  label: string
  checked?: boolean
  note?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={[
          'h-4 w-4 border border-[#7c746d] rounded-[3px] shrink-0 flex items-center justify-center text-[10px] font-bold',
          checked ? 'bg-[#201d1e] text-white' : 'text-transparent',
        ].join(' ')}
      >
        X
      </span>
      <span className="text-sm text-[#201d1e]">
        {label}
        {note ? <span className="text-[#6f6863]"> · {note}</span> : null}
      </span>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[22px] border border-[#d9d0c3] bg-white p-5 print-no-break">
      <div className="mb-4">
        <h2 className="text-[18px] font-semibold text-[#201d1e]">{title}</h2>
        {subtitle && <p className="text-sm text-[#6f6863] mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function PrintablePage({ children }: { children: React.ReactNode }) {
  return (
    <section className="print-sheet-page bg-white rounded-[28px] border border-[#e5dccf] shadow-[0_16px_40px_rgba(36,31,32,0.06)] p-8">
      {children}
    </section>
  )
}

export default async function PrintableSurveyPage({ searchParams }: PrintableSurveyPageProps) {
  const params = await searchParams
  const projectId = getQueryProjectId(params.projectId)
  const { project, error } = await loadProject(projectId)
  const survey = project?.scene.siteSurvey
  const visualCoverage = project ? summarizeRoomPhotoReferences(project.scene.references) : null
  const visualDossier = project ? getVisualDossierSummary(project.scene) : null
  const workflow = survey ? validateSiteSurvey(survey).workflow : null
  const readingSummary = project
    ? {
        previewShell: getPreviewShellLabel(project.scene.previewShellMode),
        cameraPreset: getAutoCameraPresetLabel(project.scene.autoCameraPreset),
        camera: getCameraAngleLabel(project.scene),
        implantation: getImplantationLabel(project.scene),
        ambience: getRenderAmbienceLabel(project.scene.renderAmbiencePreset),
        quality: getRenderQualityLabel(project.scene.renderQualityPreset),
        delivery: getPreviewDeliveryLabel({
          previewReady: workflow?.previewReady ?? false,
          renderReady: workflow?.renderReady ?? false,
          renderQualityPreset: project.scene.renderQualityPreset,
        }),
      }
    : null

  const usefulHeights = padRows<SiteSurveyUsefulHeightSpec | null>(
    survey?.usefulHeights || [],
    5,
    () => null,
  )

  const openingRows = padRows<SiteSurveyOpeningSpec | null>(survey?.openings || [], 8, () => null)
  const uploadedReferenceRows = padRows<RoomPhotoReference | null>(
    project?.scene.references.roomPhotoAssets || [],
    6,
    () => null,
  )

  const equipmentRows = Object.entries(EQUIPMENT_LABELS).map(([type, label]) => {
    const equipment =
      survey?.desiredEquipment.find(
        (item) => item.type === type,
      ) || null

    return {
      label,
      equipment,
    }
  })

  const technicalRows = [
    { label: 'Mur arrivee eau', value: survey ? formatWall(survey.technicalConstraints.waterSupplyWall) : '' },
    { label: 'Mur evacuation', value: survey ? formatWall(survey.technicalConstraints.drainWall) : '' },
    { label: 'Mode hotte', value: survey ? HOOD_LABELS[survey.technicalConstraints.hoodMode] : '' },
    {
      label: 'Circuit electrique dedie',
      value: survey ? formatYesNo(survey.technicalConstraints.dedicatedCircuitAvailable) : '',
    },
    {
      label: 'Arrivee gaz disponible',
      value: survey ? formatYesNo(survey.technicalConstraints.gasSupplyAvailable) : '',
    },
  ]

  const topBanner = error
    ? {
        tone: 'error',
        text: `Projet introuvable ou non chargeable: ${error}. La fiche reste vierge.`,
      }
    : project
      ? {
          tone: 'info',
          text: `Fiche pre-remplie depuis le projet "${project.name}" (${project.id}). Les donnees viennent uniquement du releve structure.`,
        }
      : {
          tone: 'info',
          text: 'Aucun projectId fourni. La fiche reste vierge et peut etre imprimee comme modele terrain.',
        }

  return (
    <div className="min-h-screen bg-[#f3f0ea]">
      <div className="print:hidden sticky top-0 z-30 border-b border-[#e5dccf] bg-white/95 backdrop-blur">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8f857d]">Fiche terrain</p>
            <h1 className="text-[22px] font-semibold text-[#201d1e] mt-1">
              Releve imprimable pour Yves
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="rounded-[16px] border border-[#d8ccbc] px-4 py-2.5 text-sm font-semibold text-[#201d1e]"
            >
              Retour au studio
            </Link>
            <span className="rounded-[16px] bg-[#201d1e] px-4 py-2.5 text-sm font-semibold text-white">
              Imprimer avec Cmd+P
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-6 py-8 space-y-6 print:max-w-none print:px-0 print:py-0 print:space-y-0">
        <div
          className={[
            'print:hidden rounded-[24px] border px-5 py-4 text-sm',
            topBanner.tone === 'error'
              ? 'border-[#efc6bc] bg-[#fff1ec] text-[#8e4f3f]'
              : 'border-[#d7d8e9] bg-[#f6f6ff] text-[#3d466d]',
          ].join(' ')}
        >
          {topBanner.text}
        </div>

        <PrintablePage>
          <div className="flex items-start justify-between gap-6 border-b border-[#ece4d8] pb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#8f857d]">BP Cuisines</p>
              <h2 className="text-[28px] font-semibold text-[#201d1e] mt-2">
                Fiche terrain - releve cuisine
              </h2>
              <p className="text-sm text-[#6f6863] mt-2 max-w-[620px]">
                Objectif: relever assez d informations pour produire un plan propre, une scene 3D
                coherente et un rendu Blender interne non contractuel.
              </p>
            </div>
            <div className="text-right text-xs text-[#7f756d]">
              <p>Version papier avant ressaisie</p>
              <p>Source de verite finale: le studio</p>
              <p>Lecture preview: {readingSummary?.previewShell || getPreviewShellLabel('auto')}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <FieldLine label="Projet / client" value={project?.name} />
            <FieldLine label="Date visite" />
            <FieldLine label="Adresse" />
            <FieldLine label="Cuisiniste" />
            <FieldLine label="Telephone" />
            <FieldLine label="Reference dossier" value={project?.id} />
            <FieldLine label="Mode preview" value={readingSummary?.previewShell} />
            <FieldLine label="Camera auto" value={readingSummary?.cameraPreset} />
            <FieldLine label="Angle camera" value={readingSummary?.camera} />
            <FieldLine label="Implantation" value={readingSummary?.implantation} />
            <FieldLine label="Ambiance rendu" value={readingSummary?.ambience} />
            <FieldLine label="Qualite rendu" value={readingSummary?.quality} />
            <FieldLine label="Preview / rendu" value={readingSummary?.delivery} />
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
            <Section
              title="Croquis libre de la piece"
              subtitle="Dessiner la piece, noter les murs nord / est / sud / ouest, placer les ouvertures, les arrivees techniques et l implantation souhaitee."
            >
              <div
                className="relative rounded-[20px] border border-[#cfc5b8] h-[520px]"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(124,116,109,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(124,116,109,0.16) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              >
                <span className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-semibold tracking-[0.12em] text-[#7a6f66]">
                  NORD
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold tracking-[0.12em] text-[#7a6f66] rotate-90">
                  EST
                </span>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-semibold tracking-[0.12em] text-[#7a6f66]">
                  SUD
                </span>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold tracking-[0.12em] text-[#7a6f66] -rotate-90">
                  OUEST
                </span>
              </div>
            </Section>

            <div className="space-y-6">
              <Section
                title="Dimensions piece"
                subtitle="Ces mesures pilotent directement la boite 3D du projet."
              >
                <div className="space-y-4">
                  <FieldLine label="Largeur piece (mm)" value={formatMillimeters(survey?.dimensions.width ?? 0)} />
                  <FieldLine label="Profondeur piece (mm)" value={formatMillimeters(survey?.dimensions.depth ?? 0)} />
                  <FieldLine label="Hauteur sol-plafond (mm)" value={formatMillimeters(survey?.dimensions.height ?? 0)} />
                </div>
              </Section>

              <Section
                title="Sous-hauteurs utiles"
                subtitle="Noter les hauteurs qui expliquent les meubles hauts et les marges jusqu au plafond."
              >
                <div className="space-y-4">
                  {usefulHeights.map((usefulHeight, index) => (
                    <FieldLine
                      key={usefulHeight?.id || index}
                      label={usefulHeight?.label || `Sous-hauteur ${index + 1}`}
                      value={usefulHeight ? formatMillimeters(usefulHeight.height) : ''}
                    />
                  ))}
                </div>
                <p className="mt-4 text-xs text-[#7f756d]">
                  Controle: la somme des sous-hauteurs doit retomber sur la hauteur sol-plafond.
                </p>
              </Section>

              <Section
                title="Rappel process"
                subtitle="Toujours suivre le meme ordre pour eviter les oublis."
              >
                <ol className="space-y-2 text-sm text-[#201d1e] list-decimal pl-5">
                  <li>Mesurer la piece et les sous-hauteurs.</li>
                  <li>Relever toutes les ouvertures avec leur mur et leur offset.</li>
                  <li>Placer les contraintes techniques sur le croquis.</li>
                  <li>Noter ensuite les souhaits client, puis les finitions.</li>
                </ol>
              </Section>
            </div>
          </div>
        </PrintablePage>

        <PrintablePage>
          <Section
            title="Ouvertures relevees"
            subtitle="1 ligne = 1 porte ou 1 fenetre. Utiliser le meme mur que sur le croquis."
          >
            <div className="overflow-hidden rounded-[20px] border border-[#d9d0c3]">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f2ea] text-[#5f574f]">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Nom</th>
                    <th className="px-3 py-3 text-left font-semibold">Type</th>
                    <th className="px-3 py-3 text-left font-semibold">Mur</th>
                    <th className="px-3 py-3 text-left font-semibold">Offset</th>
                    <th className="px-3 py-3 text-left font-semibold">Largeur</th>
                    <th className="px-3 py-3 text-left font-semibold">Hauteur</th>
                    <th className="px-3 py-3 text-left font-semibold">Allege</th>
                    <th className="px-3 py-3 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {openingRows.map((opening, index) => (
                    <tr key={opening?.id || index} className="border-t border-[#ece4d8]">
                      <td className="h-11 px-3 text-[#201d1e]">{opening?.name || ''}</td>
                      <td className="h-11 px-3 text-[#201d1e]">
                        {opening ? (opening.kind === 'door' ? 'Porte' : 'Fenetre') : ''}
                      </td>
                      <td className="h-11 px-3 text-[#201d1e]">{opening ? WALL_LABELS[opening.wall] : ''}</td>
                      <td className="h-11 px-3 text-[#201d1e]">{opening ? formatMillimeters(opening.offset) : ''}</td>
                      <td className="h-11 px-3 text-[#201d1e]">{opening ? formatMillimeters(opening.width) : ''}</td>
                      <td className="h-11 px-3 text-[#201d1e]">{opening ? formatMillimeters(opening.height) : ''}</td>
                      <td className="h-11 px-3 text-[#201d1e]">{opening ? formatMillimeters(opening.baseHeight) : ''}</td>
                      <td className="h-11 px-3 text-[#201d1e]" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section
              title="Contraintes techniques"
              subtitle="Reporter l emplacement sur le croquis et noter ici ce qui peut influencer l implantation."
            >
              <div className="space-y-4">
                {technicalRows.map((row) => (
                  <FieldLine key={row.label} label={row.label} value={row.value} />
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <CheckboxItem
                  label="Hotte en evacuation exterieure"
                  checked={survey?.technicalConstraints.hoodMode === 'evacuation'}
                />
                <CheckboxItem
                  label="Hotte en recyclage"
                  checked={survey?.technicalConstraints.hoodMode === 'recycling'}
                />
                <CheckboxItem
                  label="Gaz present"
                  checked={Boolean(survey?.technicalConstraints.gasSupplyAvailable)}
                />
                <CheckboxItem
                  label="Circuit dedie present"
                  checked={Boolean(survey?.technicalConstraints.dedicatedCircuitAvailable)}
                />
              </div>
            </Section>

            <Section
              title="Equipements souhaites"
              subtitle="Cocher, preciser la quantite et noter les attentes particulieres du client."
            >
              <div className="overflow-hidden rounded-[20px] border border-[#d9d0c3]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f7f2ea] text-[#5f574f]">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold">Equipement</th>
                      <th className="px-3 py-3 text-left font-semibold">Oui</th>
                      <th className="px-3 py-3 text-left font-semibold">Non</th>
                      <th className="px-3 py-3 text-left font-semibold">Qt</th>
                      <th className="px-3 py-3 text-left font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentRows.map(({ label, equipment }) => (
                      <tr key={label} className="border-t border-[#ece4d8]">
                        <td className="px-3 py-3 text-[#201d1e]">{label}</td>
                        <td className="px-3 py-3 text-[#201d1e]">{equipment?.required ? 'X' : ''}</td>
                        <td className="px-3 py-3 text-[#201d1e]">{equipment && !equipment.required ? 'X' : ''}</td>
                        <td className="px-3 py-3 text-[#201d1e]">
                          {equipment && equipment.quantity > 0 ? String(equipment.quantity) : ''}
                        </td>
                        <td className="px-3 py-3 text-[#201d1e]">{equipment?.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </PrintablePage>

        <PrintablePage>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section
              title="Finitions generiques"
              subtitle="Pas de reference fournisseur obligatoire ici. Le but est de capter l intention visuelle."
            >
              <div className="space-y-4">
                <FieldLine label="Couleur facades" value={survey?.finishPreferences.frontsColor} />
                <FieldLine label="Couleur plan de travail" value={survey?.finishPreferences.worktopColor} />
                <FieldLine label="Couleur credence" value={survey?.finishPreferences.splashbackColor} />
                <FieldLine label="Style / couleur poignees" value={survey?.finishPreferences.handleStyle} />
                <FieldLine label="Finition electromenager" value={survey?.finishPreferences.applianceFinish} />
              </div>
            </Section>

            <Section
              title="References visuelles"
              subtitle="Ce bloc alimente la lecture du contexte sans laisser l IA inventer les dimensions."
            >
              <div className="space-y-3">
                <CheckboxItem
                  label="Croquis papier joint"
                  checked={Boolean(survey?.visualReferences.sketchProvided)}
                />
                <CheckboxItem
                  label="Photos de la piece prises"
                  checked={Boolean(survey?.visualReferences.roomPhotosProvided)}
                />
                <CheckboxItem
                  label="Photo du sol prise"
                  checked={Boolean(survey?.visualReferences.floorPhotoProvided)}
                />
                <CheckboxItem
                  label="Photo du plafond prise"
                  checked={Boolean(survey?.visualReferences.ceilingPhotoProvided)}
                />
                <CheckboxItem
                  label="Serie complete des murs prise"
                  checked={Boolean(survey?.visualReferences.fullWallSetProvided)}
                />
              </div>
              <div className="mt-5">
                <FieldLine
                  label="Nombre de photos piece"
                  value={
                    survey && survey.visualReferences.roomPhotoCount > 0
                      ? String(survey.visualReferences.roomPhotoCount)
                      : ''
                  }
                />
              </div>
              <div className="mt-4 space-y-3">
                <FieldLine
                  label="Niveau de preparation visuelle"
                  value={
                    visualDossier ? `${visualDossier.label} (${visualDossier.score}%)` : ''
                  }
                />
                <FieldLine
                  label="Couverture murs detectee"
                  value={visualCoverage ? formatWalls(visualCoverage.wallCoverage) : ''}
                />
                <FieldLine
                  label="Murs encore manquants"
                  value={visualCoverage ? formatWalls(visualCoverage.missingWalls) : ''}
                />
                <FieldLine
                  label="Details techniques"
                  value={
                    visualCoverage && visualCoverage.technicalDetailCount > 0
                      ? String(visualCoverage.technicalDetailCount)
                      : ''
                  }
                />
                <FieldLine
                  label="Details finitions"
                  value={
                    visualCoverage && visualCoverage.finishDetailCount > 0
                      ? String(visualCoverage.finishDetailCount)
                      : ''
                  }
                />
              </div>
              <div className="mt-4 rounded-[18px] border border-[#d9d0c3] bg-[#faf5ee] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e5752]">
                  Ce qu il manque encore
                </p>
                <div className="mt-3 space-y-2 text-sm text-[#201d1e]">
                  {(visualDossier?.missing.length ? visualDossier.missing : ['Rien de bloquant cote dossier visuel.']).map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className="mt-[2px] text-[#7c746d]">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 overflow-hidden rounded-[18px] border border-[#d9d0c3]">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-[#f5efe7] text-[#5e5752]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Fichier</th>
                      <th className="px-3 py-2 text-left font-semibold">Categorie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedReferenceRows.map((asset, index) => (
                      <tr key={asset?.fileName || `asset-${index}`} className="border-t border-[#e7dfd3]">
                        <td className="px-3 py-2 text-[#201d1e]">{asset?.fileName || ''}</td>
                        <td className="px-3 py-2 text-[#201d1e]">
                          {asset ? ROOM_PHOTO_CATEGORY_LABELS[asset.category] || asset.category : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
            <Section
              title="Checklist avant ressaisie"
              subtitle="Si une case manque, le projet ne doit pas partir trop vite en rendu."
            >
              <div className="space-y-3">
                {CHECKLIST_ITEMS.map((item) => (
                  <CheckboxItem
                    key={item.key}
                    label={item.label}
                    checked={Boolean(survey?.workflowChecklist[item.key])}
                  />
                ))}
              </div>
            </Section>

            <Section
              title="Notes terrain et points a surveiller"
              subtitle="Utiliser cet espace pour les doutes, les incoherences ou les demandes client non standard."
            >
              <div className="rounded-[20px] border border-[#cfc5b8] h-[340px] p-4 text-sm text-[#201d1e] whitespace-pre-wrap">
                {survey?.notes || project?.scene.notes || ''}
              </div>
            </Section>
          </div>

          <Section
            title="Comment cette fiche est reutilisee dans le logiciel"
            subtitle="Rappel simple pour Yves: le papier sert a capter l information, le studio sert a la verrouiller."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-[#201d1e]">
              <div className="rounded-[18px] bg-[#f8f3ec] p-4">
                <p className="font-semibold">1. Piece et ouvertures</p>
                <p className="mt-2 text-[#645b54]">
                  Ces mesures alimentent directement le plan 2D et la scene 3D.
                </p>
              </div>
              <div className="rounded-[18px] bg-[#f8f3ec] p-4">
                <p className="font-semibold">2. Contraintes et equipements</p>
                <p className="mt-2 text-[#645b54]">
                  Elles guident l implantation et evitent les erreurs grossieres.
                </p>
              </div>
              <div className="rounded-[18px] bg-[#f8f3ec] p-4">
                <p className="font-semibold">3. Finitions et photos</p>
                <p className="mt-2 text-[#645b54]">
                  Elles servent au rendu client sans devenir la source de verite geometrique.
                </p>
              </div>
            </div>
          </Section>
        </PrintablePage>
      </main>
    </div>
  )
}
